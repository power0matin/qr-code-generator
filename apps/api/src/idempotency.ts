import { createHash } from 'node:crypto';
import type { ApiDatabase } from './database-client.js';

export type IdempotencyReservation =
  | { readonly state: 'created' }
  | { readonly state: 'replay'; readonly responseStatus: number | null; readonly responseMetadata: Record<string, unknown> }
  | { readonly state: 'conflict' };

export function hashIdempotencyRequest(canonicalRequest: string): string {
  return createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
}

export async function reserveIdempotencyRecord(
  database: ApiDatabase,
  tenantId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000),
): Promise<IdempotencyReservation> {
  const inserted = await database.unsafe(
    'INSERT INTO moduqr.idempotency_records ' +
    '(tenant_id, idempotency_key, operation, request_hash, expires_at) ' +
    'VALUES ($1::uuid, $2, $3, $4, $5) ' +
    'ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING idempotency_key',
    [tenantId, idempotencyKey, operation, requestHash, expiresAt],
  );
  if (inserted.length === 1) return { state: 'created' };

  const existing = await database.unsafe(
    'SELECT request_hash AS "requestHash", operation, response_status AS "responseStatus", ' +
    'response_metadata AS "responseMetadata", expires_at AS "expiresAt" ' +
    'FROM moduqr.idempotency_records ' +
    'WHERE tenant_id = $1::uuid AND idempotency_key = $2',
    [tenantId, idempotencyKey],
  ) as Array<{
    requestHash: string;
    operation: string;
    responseStatus: number | null;
    responseMetadata: Record<string, unknown>;
    expiresAt: Date;
  }>;

  const record = existing[0];
  if (!record || record.expiresAt.getTime() <= Date.now()) return { state: 'conflict' };
  if (record.requestHash !== requestHash || record.operation !== operation) return { state: 'conflict' };

  return {
    state: 'replay',
    responseStatus: record.responseStatus,
    responseMetadata: record.responseMetadata,
  };
}

export async function completeIdempotencyRecord(
  database: ApiDatabase,
  tenantId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  responseStatus: number,
  responseMetadata: Record<string, unknown>,
): Promise<boolean> {
  const rows = await database.unsafe(
    'UPDATE moduqr.idempotency_records ' +
    'SET response_status = $5, response_metadata = $6::jsonb ' +
    'WHERE tenant_id = $1::uuid AND idempotency_key = $2 AND operation = $3 ' +
    'AND request_hash = $4 AND response_status IS NULL RETURNING idempotency_key',
    [tenantId, idempotencyKey, operation, requestHash, responseStatus, JSON.stringify(responseMetadata)],
  );
  return rows.length === 1;
}
