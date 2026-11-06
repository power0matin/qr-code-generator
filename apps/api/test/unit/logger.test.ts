import { describe, expect, it } from 'vitest';
import { serializeLogEntry } from '../../src/logger.js';

describe('operational logger', () => {
  it('keeps only explicitly allowed fields and bounded values', () => {
    const entry = JSON.parse(
      serializeLogEntry('info', 'http_request', {
        requestId: 'request-123',
        route: 'ready',
        method: 'GET',
        statusCode: 200,
        durationMs: 12,
        host: '127.0.0.1',
        port: 4100,
        // Runtime callers may not be TypeScript; unknown fields must still be dropped.
        authorization: 'Bearer must-not-leak',
        databaseUrl: 'postgresql://user:password@db.internal/app',
        query: 'token=secret',
        message: 'untrusted payload',
      } as never),
    ) as Record<string, unknown>;

    expect(entry).toMatchObject({
      level: 'info',
      event: 'http_request',
      requestId: 'request-123',
      route: 'ready',
      method: 'GET',
      statusCode: 200,
      durationMs: 12,
      host: '127.0.0.1',
      port: 4100,
    });
    expect(entry).not.toHaveProperty('authorization');
    expect(entry).not.toHaveProperty('databaseUrl');
    expect(entry).not.toHaveProperty('query');
    expect(entry).not.toHaveProperty('message');
  });

  it('drops malformed identifiers, hosts and out-of-range metrics', () => {
    const entry = JSON.parse(
      serializeLogEntry('warn', 'http_request', {
        requestId: 'Bearer secret',
        host: 'db.internal/path?password=secret',
        statusCode: 999,
        durationMs: -1,
        port: 70_000,
      }),
    ) as Record<string, unknown>;

    expect(entry).not.toHaveProperty('requestId');
    expect(entry).not.toHaveProperty('host');
    expect(entry).not.toHaveProperty('statusCode');
    expect(entry).not.toHaveProperty('durationMs');
    expect(entry).not.toHaveProperty('port');
  });
});
