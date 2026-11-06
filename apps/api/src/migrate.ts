import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseDatabaseUrl } from './config.js';
import { writeLog } from './logger.js';

const migrationPattern = /^\d{4}_[a-z0-9_]+\.sql$/;
const advisoryLockId = '742291420';

function buildMigrationScript(version: string, checksum: string, migrationSql: string): string {
  return [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    'SELECT pg_advisory_xact_lock(' + advisoryLockId + ');',
    'CREATE SCHEMA IF NOT EXISTS moduqr;',
    'CREATE TABLE IF NOT EXISTS moduqr.schema_migrations (',
    '  version text PRIMARY KEY,',
    "  checksum char(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),",
    '  applied_at timestamptz NOT NULL DEFAULT now()',
    ');',
    "SELECT EXISTS (SELECT 1 FROM moduqr.schema_migrations WHERE version = '" + version + "') AS already_applied \\gset",
    '\\if :already_applied',
    "SELECT (checksum = '" + checksum + "') AS checksum_matches FROM moduqr.schema_migrations WHERE version = '" + version + "' \\gset",
    '\\if :checksum_matches',
    '\\echo migration already applied',
    '\\else',
    '\\echo migration checksum mismatch',
    "DO $moduqr$ BEGIN RAISE EXCEPTION 'migration checksum mismatch'; END $moduqr$;",
    '\\endif',
    '\\else',
    migrationSql.trim(),
    "INSERT INTO moduqr.schema_migrations (version, checksum) VALUES ('" + version + "', '" + checksum + "');",
    '\\endif',
    'COMMIT;',
    '',
  ].join('\n');
}

export async function runMigrations(databaseUrl = process.env['DATABASE_URL'] ?? ''): Promise<number> {
  const databaseEnvironment = parseDatabaseUrl(databaseUrl);
  const migrationDirectory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(migrationDirectory))
    .filter((file) => migrationPattern.test(file))
    .sort();

  if (files.length === 0) throw new Error('No valid database migrations were found');

  for (const file of files) {
    const version = file.slice(0, -4);
    const migrationSql = await readFile(new URL(file, migrationDirectory), 'utf8');
    if (migrationSql.trim().length === 0) throw new Error('A database migration is empty');

    const checksum = createHash('sha256').update(migrationSql).digest('hex');
    const script = buildMigrationScript(version, checksum, migrationSql);
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...databaseEnvironment,
      PGCONNECT_TIMEOUT: '5',
    };
    delete environment['DATABASE_URL'];

    const result = spawnSync(
      'psql',
      ['-X', '-q', '--no-password', '-v', 'ON_ERROR_STOP=1'],
      {
        env: environment,
        input: script,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 1_048_576,
        windowsHide: true,
      },
    );

    if (result.error || result.status !== 0) {
      writeLog('error', 'migration_failed', { migration: version });
      throw new Error('Database migration failed');
    }
    writeLog('info', 'migration_verified', { migration: version });
  }

  return files.length;
}

const entryPath = process.argv[1];
if (entryPath && resolve(entryPath) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then((count) => writeLog('info', 'migrations_complete', { count }))
    .catch(() => {
      writeLog('error', 'migrations_failed', {
        reason: 'database_migration_error',
      });
      process.exitCode = 1;
    });
}
