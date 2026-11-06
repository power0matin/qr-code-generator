import { randomUUID } from 'node:crypto';
import type { ApiDatabase } from './database-client.js';
import { API_KEY_SCOPES, createApiKeyMaterial, type ApiKeyScope } from './api-key-crypto.js';

export interface ApiKeyMetadata {
  readonly id: string;
  readonly prefix: string;
  readonly scopes: ApiKeyScope[];
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface IssuedApiKey extends ApiKeyMetadata {
  readonly token: string;
}

interface KeyRow {
  readonly id: string;
  readonly prefix: string;
  readonly scopes: ApiKeyScope[];
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

function toMetadata(row: KeyRow): ApiKeyMetadata {
  return {
    id: row.id,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}

export async function bootstrapTenant(
  database: ApiDatabase,
  tenantName: string,
): Promise<{ tenantId: string; tenantName: string; apiKey: IssuedApiKey }> {
  const normalizedName = tenantName.trim();
  if (normalizedName.length < 1 || normalizedName.length > 120) {
    throw new Error('Tenant name must contain between 1 and 120 characters');
  }

  return database.begin(async (transaction) => {
    await transaction.unsafe('SELECT pg_advisory_xact_lock(742291421)');
    const existing = await transaction.unsafe(
      'SELECT id FROM moduqr.tenants WHERE is_bootstrap_owner = true LIMIT 1',
    ) as Array<{ id: string }>;
    if (existing.length > 0) throw new Error('A bootstrap tenant already exists');

    const tenantId = randomUUID();
    const tenants = await transaction.unsafe(
      'INSERT INTO moduqr.tenants (id, name, status, is_bootstrap_owner) ' +
      'VALUES ($1::uuid, $2, \'active\', true) RETURNING id::text AS id, name',
      [tenantId, normalizedName],
    ) as Array<{ id: string; name: string }>;

    const material = createApiKeyMaterial();
    const keyId = randomUUID();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000);
    const keys = await transaction.unsafe(
      'INSERT INTO moduqr.api_keys (id, tenant_id, prefix, secret_hash, scopes, expires_at) ' +
      'VALUES ($1::uuid, $2::uuid, $3, $4, $5::text[], $6) ' +
      'RETURNING id::text AS id, prefix, scopes, created_at AS "createdAt", ' +
      'expires_at AS "expiresAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"',
      [keyId, tenantId, material.prefix, material.secretHash, [...API_KEY_SCOPES], expiresAt],
    ) as KeyRow[];

    const tenant = tenants[0];
    const key = keys[0];
    if (!tenant || !key) throw new Error('Bootstrap tenant could not be created');

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      apiKey: { ...toMetadata(key), token: material.token },
    };
  });
}

export async function createTenantApiKey(
  database: ApiDatabase,
  tenantId: string,
  scopes: readonly ApiKeyScope[],
  expiresAt: Date | null,
): Promise<IssuedApiKey> {
  const material = createApiKeyMaterial();
  const keyId = randomUUID();
  const rows = await database.unsafe(
    'INSERT INTO moduqr.api_keys (id, tenant_id, prefix, secret_hash, scopes, expires_at) ' +
    'SELECT $1::uuid, tenants.id, $3, $4, $5::text[], $6 ' +
    'FROM moduqr.tenants WHERE tenants.id = $2::uuid AND tenants.status = \'active\' ' +
    'RETURNING id::text AS id, prefix, scopes, created_at AS "createdAt", ' +
    'expires_at AS "expiresAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"',
    [keyId, tenantId, material.prefix, material.secretHash, [...scopes], expiresAt],
  ) as KeyRow[];

  const row = rows[0];
  if (!row) throw new Error('Tenant is unavailable');
  return { ...toMetadata(row), token: material.token };
}

export async function listTenantApiKeys(
  database: ApiDatabase,
  tenantId: string,
): Promise<ApiKeyMetadata[]> {
  const rows = await database.unsafe(
    'SELECT id::text AS id, prefix, scopes, created_at AS "createdAt", ' +
    'expires_at AS "expiresAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt" ' +
    'FROM moduqr.api_keys WHERE tenant_id = $1::uuid ' +
    'ORDER BY created_at DESC, id DESC LIMIT 100',
    [tenantId],
  ) as KeyRow[];
  return rows.map(toMetadata);
}

export async function revokeTenantApiKey(
  database: ApiDatabase,
  tenantId: string,
  keyId: string,
): Promise<boolean> {
  const rows = await database.unsafe(
    'UPDATE moduqr.api_keys SET revoked_at = COALESCE(revoked_at, now()) ' +
    'WHERE id = $1::uuid AND tenant_id = $2::uuid RETURNING id',
    [keyId, tenantId],
  );
  return rows.length === 1;
}

export async function rotateTenantApiKey(
  database: ApiDatabase,
  tenantId: string,
  keyId: string,
  replacementScopes: readonly ApiKeyScope[] | undefined,
  replacementExpiry: Date | null,
): Promise<IssuedApiKey | null> {
  const material = createApiKeyMaterial();
  const newKeyId = randomUUID();

  return database.begin(async (transaction) => {
    const existing = await transaction.unsafe(
      'SELECT scopes, revoked_at AS "revokedAt", expires_at AS "expiresAt" ' +
      'FROM moduqr.api_keys WHERE id = $1::uuid AND tenant_id = $2::uuid FOR UPDATE',
      [keyId, tenantId],
    ) as Array<{ scopes: ApiKeyScope[]; revokedAt: Date | null; expiresAt: Date | null }>;

    const previous = existing[0];
    if (!previous || previous.revokedAt !== null) return null;
    if (previous.expiresAt !== null && previous.expiresAt.getTime() <= Date.now()) return null;

    const revoked = await transaction.unsafe(
      'UPDATE moduqr.api_keys SET revoked_at = now() ' +
      'WHERE id = $1::uuid AND tenant_id = $2::uuid AND revoked_at IS NULL RETURNING id',
      [keyId, tenantId],
    );
    if (revoked.length !== 1) return null;

    const rows = await transaction.unsafe(
      'INSERT INTO moduqr.api_keys (id, tenant_id, prefix, secret_hash, scopes, expires_at) ' +
      'VALUES ($1::uuid, $2::uuid, $3, $4, $5::text[], $6) ' +
      'RETURNING id::text AS id, prefix, scopes, created_at AS "createdAt", ' +
      'expires_at AS "expiresAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"',
      [newKeyId, tenantId, material.prefix, material.secretHash, [...(replacementScopes ?? previous.scopes)], replacementExpiry],
    ) as KeyRow[];

    const row = rows[0];
    if (!row) throw new Error('Replacement API key could not be created');
    return { ...toMetadata(row), token: material.token };
  });
}
