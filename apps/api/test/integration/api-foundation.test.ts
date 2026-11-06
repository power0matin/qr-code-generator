import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from '../../src/config.js';
import { createDatabaseProbe } from '../../src/database.js';
import { createHealthServer } from '../../src/health-server.js';

const databaseUrl = process.env['DATABASE_URL'];
const migrationEntry = fileURLToPath(new URL('../../dist/migrate.js', import.meta.url));

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

    const query = spawnSync(
      'psql',
      [
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '--no-password',
        '-c',
        "SELECT (SELECT schema_version FROM moduqr.instance_metadata WHERE singleton = true)::text || '|' || (SELECT count(*) FROM moduqr.schema_migrations)::text",
      ],
      {
        env: {
          ...process.env,
          ...parseDatabaseUrl(databaseUrl),
          PGCONNECT_TIMEOUT: '3',
        },
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 1024,
      },
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
