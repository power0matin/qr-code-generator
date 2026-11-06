import type { IncomingHttpHeaders } from 'node:http';
import type { ApiDatabase } from './database-client.js';
import {
  parseBearerAuthorization,
  verifyApiKeySecret,
  type ApiKeyScope,
} from './api-key-crypto.js';

export interface AuthenticatedApiKey {
  readonly id: string;
  readonly tenantId: string;
  readonly scopes: ApiKeyScope[];
}

interface ApiKeyAuthRow {
  readonly id: string;
  readonly tenantId: string;
  readonly secretHash: string;
  readonly scopes: ApiKeyScope[];
  readonly keyExpiresAt: Date | string | null;
  readonly revokedAt: Date | string | null;
  readonly tenantStatus: 'active' | 'disabled';
}

function timestamp(value: Date | string | null): number | null {
  if (value === null) return null;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export async function authenticateApiKey(
  database: ApiDatabase,
  headers: IncomingHttpHeaders,
  now = new Date(),
): Promise<AuthenticatedApiKey | null> {
  const parsed = parseBearerAuthorization(headers.authorization);
  if (!parsed) return null;

  const rows = await database.unsafe(
    'SELECT api_keys.id::text AS "id", api_keys.tenant_id::text AS "tenantId", ' +
    'api_keys.secret_hash AS "secretHash", api_keys.scopes AS "scopes", ' +
    'api_keys.expires_at AS "keyExpiresAt", api_keys.revoked_at AS "revokedAt", ' +
    'tenants.status AS "tenantStatus" ' +
    'FROM moduqr.api_keys INNER JOIN moduqr.tenants ON tenants.id = api_keys.tenant_id ' +
    'WHERE api_keys.prefix = $1 LIMIT 1',
    [parsed.prefix],
  ) as ApiKeyAuthRow[];

  const record = rows[0];
  const secretMatches = verifyApiKeySecret(parsed.secret, record?.secretHash ?? '');
  if (!record || !secretMatches) return null;
  if (record.tenantStatus !== 'active' || record.revokedAt !== null) return null;

  const expiry = timestamp(record.keyExpiresAt);
  if (expiry !== null && (!Number.isFinite(expiry) || expiry <= now.getTime())) return null;

  await database.unsafe(
    'UPDATE moduqr.api_keys SET last_used_at = $1 ' +
    'WHERE id = $2::uuid AND revoked_at IS NULL ' +
    'AND (last_used_at IS NULL OR last_used_at < $3)',
    [now, record.id, new Date(now.getTime() - 60_000)],
  );

  return { id: record.id, tenantId: record.tenantId, scopes: record.scopes };
}
