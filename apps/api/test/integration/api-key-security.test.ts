import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiDatabase } from '../../src/database-client.js';
import { runMigrations } from '../../src/migrate.js';
import { bootstrapTenant, createTenantApiKey } from '../../src/api-key-service.js';
import { createHealthServer } from '../../src/health-server.js';
import { handleApiKeyRequest } from '../../src/api-key-handler.js';
import { consumeApiKeyRateLimit } from '../../src/api-rate-limit.js';
import {
  completeIdempotencyRecord,
  hashIdempotencyRequest,
  reserveIdempotencyRecord,
} from '../../src/idempotency.js';
import type { ApiDatabase } from '../../src/database-client.js';
import type { Server } from 'node:http';

const databaseUrl = process.env['DATABASE_URL'];
let database: ApiDatabase | undefined;
let server: Server | undefined;
let origin = '';
let bootstrapTenantId = '';
let secondaryTenantId = '';

async function listen(): Promise<void> {
  if (!database) throw new Error('Integration database is not initialized');
  server = createHealthServer({
    probeDatabase: async () => true,
    handleApiRequest: (request, response, requestId) =>
      handleApiKeyRequest(database as ApiDatabase, request, response, requestId),
  });

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('API test server did not bind');
  origin = 'http://127.0.0.1:' + address.port;
}

async function apiRequest(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.token) headers['authorization'] = 'Bearer ' + options.token;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  return fetch(origin + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function responseJson(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>;
}

beforeAll(async () => {
  if (!databaseUrl) throw new Error('DATABASE_URL must point to a disposable PostgreSQL database');
  await runMigrations(databaseUrl);
  database = createApiDatabase(databaseUrl);

  // The CI service is disposable. Reset only the single bootstrap fixture so this
  // test remains repeatable when the same integration database is reused locally.
  await database.unsafe('DELETE FROM moduqr.tenants WHERE is_bootstrap_owner = true');
}, 60_000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (database) {
    if (bootstrapTenantId) {
      await database.unsafe('DELETE FROM moduqr.tenants WHERE id = $1::uuid', [bootstrapTenantId]);
    }
    if (secondaryTenantId) {
      await database.unsafe('DELETE FROM moduqr.tenants WHERE id = $1::uuid', [secondaryTenantId]);
    }
    await database.end({ timeout: 5 });
  }
});

describe('Phase 3B tenant API-key security', () => {
  it('enforces tenant isolation, key lifecycle, rate limits and idempotency', async () => {
    if (!database) throw new Error('Integration database is not initialized');

    const bootstrap = await bootstrapTenant(database, 'ModuQR security integration');
    bootstrapTenantId = bootstrap.tenantId;
    expect(bootstrap.apiKey.token).toMatch(/^mqk_live_/);
    await expect(bootstrapTenant(database, 'Duplicate bootstrap')).rejects.toThrow(
      'A bootstrap tenant already exists',
    );

    secondaryTenantId = randomUUID();
    await database.unsafe(
      'INSERT INTO moduqr.tenants (id, name, status, is_bootstrap_owner) ' +
      'VALUES ($1::uuid, $2, \'active\', false)',
      [secondaryTenantId, 'Secondary integration tenant'],
    );

    const secondaryKey = await createTenantApiKey(
      database,
      secondaryTenantId,
      ['keys:manage'],
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
    );

    await listen();

    const unauthenticated = await apiRequest('/v1/api-keys');
    expect(unauthenticated.status).toBe(401);

    const invalidToken = await apiRequest('/v1/api-keys', { token: 'mqk_live_invalid.invalid' });
    expect(invalidToken.status).toBe(401);

    const firstList = await apiRequest('/v1/api-keys', { token: bootstrap.apiKey.token });
    expect(firstList.status).toBe(200);
    expect(firstList.headers.get('cache-control')).toBe('no-store');
    expect(firstList.headers.get('ratelimit-limit')).toBe('60');
    const firstListBody = await responseJson(firstList);
    expect(firstListBody.data).toHaveLength(1);
    expect(firstListBody.data[0].id).toBe(bootstrap.apiKey.id);
    expect(firstListBody.data[0]).not.toHaveProperty('token');
    expect(firstListBody.data[0]).not.toHaveProperty('secretHash');

    const restrictedCreate = await apiRequest('/v1/api-keys', {
      method: 'POST',
      token: bootstrap.apiKey.token,
      body: { scopes: ['links:read'], expiresAt: null },
    });
    expect(restrictedCreate.status).toBe(201);
    const restrictedBody = await responseJson(restrictedCreate);
    const restrictedKey = restrictedBody.data as { id: string; token: string; scopes: string[] };
    expect(restrictedKey.token).toMatch(/^mqk_live_/);
    expect(restrictedKey.scopes).toEqual(['links:read']);

    const tenantSpoof = await apiRequest('/v1/api-keys', {
      method: 'POST',
      token: bootstrap.apiKey.token,
      body: { tenantId: secondaryTenantId, scopes: ['keys:manage'] },
    });
    expect(tenantSpoof.status).toBe(400);

    const replaySecret = await apiRequest('/v1/api-keys', {
      method: 'POST',
      token: bootstrap.apiKey.token,
      headers: { 'idempotency-key': 'should-not-replay-secret' },
      body: { scopes: ['links:read'] },
    });
    expect(replaySecret.status).toBe(400);

    const restrictedList = await apiRequest('/v1/api-keys', { token: restrictedKey.token });
    expect(restrictedList.status).toBe(403);

    const secondaryList = await apiRequest('/v1/api-keys', { token: secondaryKey.token });
    expect(secondaryList.status).toBe(200);
    const secondaryBody = await responseJson(secondaryList);
    expect(secondaryBody.data).toHaveLength(1);
    expect(secondaryBody.data[0].id).toBe(secondaryKey.id);
    expect(secondaryBody.data[0].id).not.toBe(bootstrap.apiKey.id);

    const crossTenantRevoke = await apiRequest('/v1/api-keys/' + secondaryKey.id, {
      method: 'DELETE',
      token: bootstrap.apiKey.token,
    });
    expect(crossTenantRevoke.status).toBe(404);

    const rotation = await apiRequest('/v1/api-keys/' + bootstrap.apiKey.id + '/rotate', {
      method: 'POST',
      token: bootstrap.apiKey.token,
      body: { expiresAt: null },
    });
    expect(rotation.status).toBe(201);
    const rotationBody = await responseJson(rotation);
    const rotated = rotationBody.data as { id: string; token: string; scopes: string[] };
    expect(rotated.token).toMatch(/^mqk_live_/);
    expect(rotated.id).not.toBe(bootstrap.apiKey.id);
    expect(rotated.scopes).toContain('keys:manage');

    const oldOwnerKey = await apiRequest('/v1/api-keys', { token: bootstrap.apiKey.token });
    expect(oldOwnerKey.status).toBe(401);

    const revoked = await apiRequest('/v1/api-keys/' + restrictedKey.id, {
      method: 'DELETE',
      token: rotated.token,
    });
    expect(revoked.status).toBe(200);
    const revokedUse = await apiRequest('/v1/api-keys', { token: restrictedKey.token });
    expect(revokedUse.status).toBe(401);

    const windowStart = new Date('2026-11-07T12:00:00.000Z');
    const limitOne = await consumeApiKeyRateLimit(database, secondaryKey.id, 2, windowStart);
    const limitTwo = await consumeApiKeyRateLimit(database, secondaryKey.id, 2, new Date(windowStart.getTime() + 1_000));
    const limitThree = await consumeApiKeyRateLimit(database, secondaryKey.id, 2, new Date(windowStart.getTime() + 2_000));
    expect(limitOne.allowed).toBe(true);
    expect(limitOne.remaining).toBe(1);
    expect(limitTwo.allowed).toBe(true);
    expect(limitTwo.remaining).toBe(0);
    expect(limitThree.allowed).toBe(false);
    expect(limitThree.remaining).toBe(0);

    const idempotencyKey = 'integration-' + randomUUID();
    const requestHash = hashIdempotencyRequest('POST /v1/links {"destination":"https://example.com"}');
    const reserved = await reserveIdempotencyRecord(database, bootstrapTenantId, idempotencyKey, 'link.create', requestHash);
    expect(reserved.state).toBe('created');

    const completed = await completeIdempotencyRecord(
      database,
      bootstrapTenantId,
      idempotencyKey,
      'link.create',
      requestHash,
      201,
      { resourceId: randomUUID() },
    );
    expect(completed).toBe(true);

    const replay = await reserveIdempotencyRecord(database, bootstrapTenantId, idempotencyKey, 'link.create', requestHash);
    expect(replay.state).toBe('replay');
    if (replay.state === 'replay') {
      expect(replay.responseStatus).toBe(201);
      expect(replay.responseMetadata).toHaveProperty('resourceId');
    }

    const conflictingReplay = await reserveIdempotencyRecord(
      database,
      bootstrapTenantId,
      idempotencyKey,
      'link.create',
      hashIdempotencyRequest('POST /v1/links {"destination":"https://other.example"}'),
    );
    expect(conflictingReplay.state).toBe('conflict');

    const separateTenantKey = await reserveIdempotencyRecord(
      database,
      secondaryTenantId,
      idempotencyKey,
      'link.create',
      requestHash,
    );
    expect(separateTenantKey.state).toBe('created');
  }, 60_000);
});
