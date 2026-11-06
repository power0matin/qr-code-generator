import { describe, expect, it } from 'vitest';
import { loadApiConfig, parseDatabaseUrl } from '../../src/config.js';

describe('database configuration', () => {
  it('parses a PostgreSQL URL without logging or exposing credentials', () => {
    expect(
      parseDatabaseUrl('postgresql://api_user:p%40ss%2Fword@db.internal:5433/moduqr?sslmode=require'),
    ).toEqual({
      PGHOST: 'db.internal',
      PGPORT: '5433',
      PGUSER: 'api_user',
      PGPASSWORD: 'p@ss/word',
      PGDATABASE: 'moduqr',
      PGAPPNAME: 'moduqr-api',
      PGCONNECT_TIMEOUT: '2',
      PGSSLMODE: 'require',
    });
  });

  it('supports IPv6 database hosts', () => {
    expect(parseDatabaseUrl('postgresql://api_user:secret@[::1]:5432/moduqr')['PGHOST']).toBe('::1');
  });

  it.each([
    'https://db.internal/moduqr',
    'postgresql:///moduqr',
    'postgresql://api_user@db.internal/',
    'postgresql://api_user@db.internal/moduqr?sslmode=unknown',
    'postgresql://api_user@db.internal/moduqr?application_name=unreviewed',
  ])('rejects unsupported or incomplete database URLs', (databaseUrl) => {
    expect(() => parseDatabaseUrl(databaseUrl)).toThrow();
  });

  it('validates runtime port and requires a database URL', () => {
    expect(() => loadApiConfig({ PORT: '0' })).toThrow();
    expect(() =>
      loadApiConfig({
        DATABASE_URL: 'postgresql://api_user:secret@db.internal/moduqr',
        PORT: '70000',
      }),
    ).toThrow();
  });

  it('uses an explicit, bounded API runtime configuration', () => {
    expect(
      loadApiConfig({
        DATABASE_URL: 'postgresql://api_user:secret@db.internal/moduqr',
        PORT: '4400',
        HOST: '127.0.0.1',
      }),
    ).toMatchObject({
      host: '127.0.0.1',
      port: 4400,
      databaseEnvironment: {
        PGHOST: 'db.internal',
        PGPORT: '5432',
        PGUSER: 'api_user',
        PGDATABASE: 'moduqr',
      },
    });
  });
});
