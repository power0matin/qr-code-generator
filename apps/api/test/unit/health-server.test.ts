import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHealthServer } from '../../src/health-server.js';

const servers: Server[] = [];

async function withServer(
  probeDatabase: () => Promise<boolean>,
  callback: (origin: string) => Promise<void>,
): Promise<void> {
  const server = createHealthServer({ probeDatabase });
  servers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  try {
    await callback('http://127.0.0.1:' + address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    const index = servers.indexOf(server);
    if (index >= 0) servers.splice(index, 1);
  }
}

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  servers.length = 0;
});

describe('API health surface', () => {
  it('keeps liveness independent from database availability', async () => {
    const probe = vi.fn(async () => false);

    await withServer(probe, async (origin) => {
      const response = await fetch(origin + '/health/live');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
      expect(probe).not.toHaveBeenCalled();
    });
  });

  it('returns readiness only after a successful database probe', async () => {
    await withServer(async () => true, async (origin) => {
      const response = await fetch(origin + '/health/ready', {
        headers: { 'x-request-id': 'acceptance-check-01' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('x-request-id')).toBe('acceptance-check-01');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({
        status: 'ok',
        checks: { database: 'ok' },
      });
    });
  });

  it('fails readiness closed when the database probe fails or throws', async () => {
    for (const probe of [
      async () => false,
      async () => {
        throw new Error('private connection detail');
      },
    ]) {
      await withServer(probe, async (origin) => {
        const response = await fetch(origin + '/health/ready');
        const payload = await response.json();
        expect(response.status).toBe(503);
        expect(payload).toMatchObject({
          status: 'not_ready',
          checks: { database: 'unavailable' },
        });
        expect(JSON.stringify(payload)).not.toContain('private connection detail');
      });
    }
  });

  it('does not expose unknown paths or echo query parameters', async () => {
    await withServer(async () => true, async (origin) => {
      const response = await fetch(origin + '/unknown?token=must-not-be-logged');
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ status: 'not_found' });
    });
  });

  it('rejects non-read methods and handles HEAD without a response body', async () => {
    await withServer(async () => true, async (origin) => {
      const post = await fetch(origin + '/health/live', { method: 'POST' });
      expect(post.status).toBe(405);
      expect(post.headers.get('allow')).toBe('GET, HEAD');
      await post.text();

      const head = await fetch(origin + '/health/live', { method: 'HEAD' });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe('');
    });
  });
});
