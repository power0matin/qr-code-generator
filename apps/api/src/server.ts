import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiDatabase } from './database-client.js';
import { loadApiConfig } from './config.js';
import { createDatabaseProbe } from './database.js';
import { handleApiKeyRequest } from './api-key-handler.js';
import { createHealthServer } from './health-server.js';
import { writeLog } from './logger.js';

export function startServer(): void {
  let config: ReturnType<typeof loadApiConfig>;

  try {
    config = loadApiConfig(process.env);
  } catch {
    writeLog('error', 'startup_failed', {
      reason: 'invalid_or_missing_environment',
    });
    process.exitCode = 1;
    return;
  }

  const database = createApiDatabase(config.databaseUrl);
  const server = createHealthServer({
    probeDatabase: createDatabaseProbe(config.databaseEnvironment),
    handleApiRequest: (request, response, requestId) =>
      handleApiKeyRequest(database, request, response, requestId),
  });

  server.once('error', () => {
    writeLog('error', 'server_listen_failed', {
      host: config.host,
      port: config.port,
    });
    process.exitCode = 1;
    void database.end({ timeout: 5 }).catch(() => {
      process.exitCode = 1;
    });
  });

  server.listen(config.port, config.host, () => {
    writeLog('info', 'server_started', {
      host: config.host,
      port: config.port,
    });
  });

  let shuttingDown = false;
  const shutdown = (signal: 'SIGINT' | 'SIGTERM'): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    writeLog('info', 'server_shutdown_started', { signal });

    const forceClose = setTimeout(() => {
      server.closeAllConnections();
      process.exitCode = 1;
    }, 10_000);
    forceClose.unref();

    server.close((error) => {
      clearTimeout(forceClose);
      if (error) {
        writeLog('error', 'server_shutdown_failed', {
          reason: 'http_server_close_failed',
        });
        process.exitCode = 1;
        return;
      }

      void database.end({ timeout: 5 }).then(() => {
        writeLog('info', 'server_shutdown_complete', { signal });
      }).catch(() => {
        writeLog('error', 'server_shutdown_failed', {
          reason: 'database_pool_close_failed',
        });
        process.exitCode = 1;
      });
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

const entryPath = process.argv[1];
if (entryPath && resolve(entryPath) === fileURLToPath(import.meta.url)) {
  startServer();
}
