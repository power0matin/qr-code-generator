export type LogLevel = 'info' | 'warn' | 'error';

export type LogEvent =
  | 'http_request'
  | 'database_readiness_failed'
  | 'startup_failed'
  | 'server_listen_failed'
  | 'server_started'
  | 'server_shutdown_started'
  | 'server_shutdown_failed'
  | 'server_shutdown_complete'
  | 'migration_failed'
  | 'migration_verified'
  | 'migrations_complete'
  | 'migrations_failed';

export interface LogFields {
  readonly requestId?: string;
  readonly route?: 'live' | 'ready' | 'unknown';
  readonly method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'OTHER' | 'UNKNOWN';
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly host?: string;
  readonly port?: number;
  readonly signal?: 'SIGINT' | 'SIGTERM';
  readonly migration?: string;
  readonly count?: number;
  readonly reason?: 'invalid_or_missing_environment' | 'http_server_close_failed' | 'database_migration_error';
}

const allowedMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'OTHER', 'UNKNOWN']);

function sanitizeFields(fields: LogFields): Readonly<Record<string, string | number>> {
  const safe: Record<string, string | number> = {};

  if (typeof fields.requestId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(fields.requestId)) {
    safe['requestId'] = fields.requestId;
  }
  if (fields.route === 'live' || fields.route === 'ready' || fields.route === 'api' || fields.route === 'unknown') {
    safe['route'] = fields.route;
  }
  if (typeof fields.method === 'string' && allowedMethods.has(fields.method)) {
    safe['method'] = fields.method;
  }
  if (Number.isInteger(fields.statusCode) && fields.statusCode !== undefined && fields.statusCode >= 100 && fields.statusCode <= 599) {
    safe['statusCode'] = fields.statusCode;
  }
  if (Number.isSafeInteger(fields.durationMs) && fields.durationMs !== undefined && fields.durationMs >= 0 && fields.durationMs <= 600_000) {
    safe['durationMs'] = fields.durationMs;
  }
  if (typeof fields.host === 'string' && fields.host.length <= 255 && /^[A-Za-z0-9.:_-]+$/.test(fields.host)) {
    safe['host'] = fields.host;
  }
  if (Number.isInteger(fields.port) && fields.port !== undefined && fields.port >= 1 && fields.port <= 65_535) {
    safe['port'] = fields.port;
  }
  if (fields.signal === 'SIGINT' || fields.signal === 'SIGTERM') {
    safe['signal'] = fields.signal;
  }
  if (typeof fields.migration === 'string' && /^\d{4}_[a-z0-9_]{1,80}$/.test(fields.migration)) {
    safe['migration'] = fields.migration;
  }
  if (Number.isSafeInteger(fields.count) && fields.count !== undefined && fields.count >= 0) {
    safe['count'] = fields.count;
  }
  if (
    fields.reason === 'invalid_or_missing_environment' ||
    fields.reason === 'http_server_close_failed' ||
    fields.reason === 'database_migration_error'
  ) {
    safe['reason'] = fields.reason;
  }

  return safe;
}

export function serializeLogEntry(level: LogLevel, event: LogEvent, fields: LogFields = {}): string {
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...sanitizeFields(fields),
  });
}

export function writeLog(level: LogLevel, event: LogEvent, fields: LogFields = {}): void {
  process.stdout.write(serializeLogEntry(level, event, fields) + '\n');
}
