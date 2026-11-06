import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from '../../src/config.js';
import { createDatabaseProbe } from '../../src/database.js';
import { createHealthServer } from '../../src/health-server.js';

const databaseUrl = process.env['DATABASE_URL'];
const migrationEntry = fileURLToPath(new URL('../../dist/migrate.js', import.meta.url));
const migrationSource = fileURLToPath(new URL('../../migrations/0001_initial_platform.sql', import.meta.url));

function runPsql(sql: string) {
  if (!databaseUrl) throw new Error('DATABASE_URL must point to the CI PostgreSQL service');
  return spawnSync(
    'psql',
    ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-password', '-c', sql],
    {
      env: { ...process.env, ...parseDatabaseUrl(databaseUrl) },
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1024,
    },
  );
}

describe('PostgreSQL API foundation', () => {
  it('migrates a clean database, verifies checksums, and exposes readiness', async () => {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must point to the CI PostgreSQL service');
    }

    const childEnvironment = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    for (let run = 0; run < 2; run += 1) {
      const migration = spawnSync(process.execPath, [migrationEntry], {
        env: childEnvironment,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 1_048_576,
      });

      expect(migration.error).toBeUndefined();
      expect(migration.status).toBe(0);
    }

    const migrationSql = await readFile(migrationSource, 'utf8');
    const migrationChecksum = createHash('sha256').update(migrationSql).digest('hex');
    const tamper = runPsql(
      "UPDATE moduqr.schema_migrations SET checksum = repeat('0', 64) WHERE version = '0001_initial_platform'",
    );
    expect(tamper.error).toBeUndefined();
    expect(tamper.status).toBe(0);
    const tamperedChecksum = runPsql(
      "SELECT checksum = repeat('0', 64) FROM moduqr.schema_migrations WHERE version = '0001_initial_platform'",
    );
    expect(tamperedChecksum.error).toBeUndefined();
    expect(tamperedChecksum.status).toBe(0);
    expect(tamperedChecksum.stdout.trim()).toBe('t');

    const tamperedReplay = spawnSync(process.execPath, [migrationEntry], {
      env: childEnvironment,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1_048_576,
    });
    expect(tamperedReplay.error).toBeUndefined();
    expect(tamperedReplay.status).not.toBe(0);

    const restore = runPsql(
      "UPDATE moduqr.schema_migrations SET checksum = '" + migrationChecksum + "' WHERE version = '0001_initial_platform'",
    );
    expect(restore.error).toBeUndefined();
    expect(restore.status).toBe(0);
    const restoredChecksum = runPsql(
      "SELECT checksum = '" + migrationChecksum + "' FROM moduqr.schema_migrations WHERE version = '0001_initial_platform'",
    );
    expect(restoredChecksum.error).toBeUndefined();
    expect(restoredChecksum.status).toBe(0);
    expect(restoredChecksum.stdout.trim()).toBe('t');

    const query = runPsql(
      "SELECT (SELECT schema_version FROM moduqr.instance_metadata WHERE singleton = true)::text || '|' || (SELECT count(*) FROM moduqr.schema_migrations)::text",
    );
    expect(query.error).toBeUndefined();
    expect(query.status).toBe(0);
    expect(query.stdout.trim()).toBe('1|1');

    const server = createHealthServer({
      probeDatabase: createDatabaseProbe(parseDatabaseUrl(databaseUrl)),
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('The integration test server did not bind to a TCP port');
    }

    try {
      const response = await fetch('http://127.0.0.1:' + address.port + '/health/ready');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'ok',
        checks: { database: 'ok' },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }, 60_000);
});
