import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { DatabaseProbe } from './database.js';
import { writeLog, type LogEvent, type LogFields, type LogLevel } from './logger.js';

export type HealthLogger = (
  level: LogLevel,
  event: LogEvent,
  fields?: LogFields,
) => void;

export interface HealthServerOptions {
  readonly probeDatabase: DatabaseProbe;
  readonly log?: HealthLogger;
}

function getRequestId(request: IncomingMessage): string {
  const header = request.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (candidate && /^[A-Za-z0-9._-]{1,64}$/.test(candidate)) return candidate;
  return randomUUID();
}

function sendJson(
  response: ServerResponse,
  method: string,
  statusCode: number,
  payload: Readonly<Record<string, unknown>>,
  requestId: string,
): void {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-request-id', requestId);
  response.setHeader('content-length', String(Buffer.byteLength(body)));
  response.end(method === 'HEAD' ? undefined : body);
}

function getRoute(request: IncomingMessage): 'live' | 'ready' | 'unknown' {
  try {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/health/live') return 'live';
    if (pathname === '/health/ready') return 'ready';
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

export function createHealthServer(options: HealthServerOptions): Server {
  const log = options.log ?? writeLog;

  const server = createServer((request, response) => {
    void (async () => {
      const startedAt = Date.now();
      const requestId = getRequestId(request);
      const method = request.method ?? 'UNKNOWN';
      const route = getRoute(request);
      let statusCode = 200;

      if (method !== 'GET' && method !== 'HEAD') {
        statusCode = 405;
        response.setHeader('allow', 'GET, HEAD');
        sendJson(response, method, statusCode, {
          status: 'method_not_allowed',
          requestId,
        }, requestId);
      } else if (route === 'live') {
        sendJson(response, method, statusCode, { status: 'ok' }, requestId);
      } else if (route === 'ready') {
        let databaseAvailable = false;
        try {
          databaseAvailable = await options.probeDatabase();
        } catch {
          databaseAvailable = false;
        }

        if (databaseAvailable) {
          sendJson(response, method, statusCode, {
            status: 'ok',
            checks: { database: 'ok' },
          }, requestId);
        } else {
          statusCode = 503;
          log('warn', 'database_readiness_failed', { requestId });
          sendJson(response, method, statusCode, {
            status: 'not_ready',
            checks: { database: 'unavailable' },
            requestId,
          }, requestId);
        }
      } else {
        statusCode = 404;
        sendJson(response, method, statusCode, {
          status: 'not_found',
          requestId,
        }, requestId);
      }

      log('info', 'http_request', {
        requestId,
        route,
        method,
        statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    })().catch(() => {
      if (!response.headersSent) {
        sendJson(response, request.method ?? 'UNKNOWN', 500, {
          status: 'internal_error',
        }, randomUUID());
      } else if (!response.writableEnded) {
        response.destroy();
      }
    });
  });

  server.headersTimeout = 8_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  server.maxHeadersCount = 32;

  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  return server;
}
