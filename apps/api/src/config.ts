const allowedSslModes = new Set([
  'disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full',
]);

export interface ApiRuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly databaseEnvironment: NodeJS.ProcessEnv;
}

export function parseDatabaseUrl(value: string): NodeJS.ProcessEnv {
  if (value.length === 0 || value.length > 2048) {
    throw new Error('DATABASE_URL is missing or invalid');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }
  if (!url.hostname || !url.username || url.hash) {
    throw new Error('DATABASE_URL is missing required connection fields');
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('DATABASE_URL must identify exactly one database');
  }

  const port = url.port === '' ? 5432 : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DATABASE_URL contains an invalid port');
  }

  for (const parameter of url.searchParams.keys()) {
    if (parameter !== 'sslmode') {
      throw new Error('DATABASE_URL contains an unsupported connection option');
    }
  }

  const sslModes = url.searchParams.getAll('sslmode');
  if (sslModes.length > 1 || (sslModes[0] !== undefined && !allowedSslModes.has(sslModes[0]))) {
    throw new Error('DATABASE_URL contains an invalid SSL mode');
  }

  let username: string;
  let password: string;
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error('DATABASE_URL contains invalid credential encoding');
  }

  if (!username) {
    throw new Error('DATABASE_URL must include a database username');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host) {
    throw new Error('DATABASE_URL must include a database host');
  }

  const environment: NodeJS.ProcessEnv = {
    PGHOST: host,
    PGPORT: String(port),
    PGUSER: username,
    PGPASSWORD: password,
    PGDATABASE: databaseName,
    PGAPPNAME: 'moduqr-api',
    PGCONNECT_TIMEOUT: '2',
  };

  const sslMode = sslModes[0];
  if (sslMode) environment['PGSSLMODE'] = sslMode;
  return environment;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv): ApiRuntimeConfig {
  const databaseUrl = environment['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const portValue = environment['PORT'] ?? '4100';
  if (!/^\d+$/.test(portValue)) throw new Error('PORT must be a valid TCP port');

  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  const host = environment['HOST'] ?? '0.0.0.0';
  if (host.trim().length === 0 || host.length > 255) throw new Error('HOST is invalid');

  return {
    host,
    port,
    databaseEnvironment: parseDatabaseUrl(databaseUrl),
  };
}
