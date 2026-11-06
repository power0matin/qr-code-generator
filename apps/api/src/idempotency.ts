import { createHash } from 'node:crypto';
import type { ApiDatabase } from './database-client.js';

export type IdempotencyReservation =
  | { readonly state: 'created' }
  | { readonly state: 'replay'; readonly responseStatus: number | null; readonly responseMetadata: Record<string, unknown> }
  | { readonly state: 'conflict' };

export function hashIdempotencyRequest(canonicalRequest: string): string {
  return createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
}

const forbiddenMetadataFields = ['token', 'secret', 'password', 'authorization', 'apikey', 'credential', 'bearer'];

export function assertSafeIdempotencyMetadata(metadata: Record<string, unknown>): string {
  const serialized = JSON.stringify(metadata);
  if (Buffer.byteLength(serialized, 'utf8') > 7_168) {
    throw new Error('Idempotency metadata exceeds the 8 KiB limit');
  }

  const inspect = (value: unknown, depth: number): void => {
    if (depth > 8) throw new Error('Idempotency metadata is too deeply nested');
    if (Array.isArray(value)) {
      for (const item of value) inspect(item, depth + 1);
      return;
    }
    if (value === null || typeof value !== 'object') return;

    for (const [key, nested] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
      if (forbiddenMetadataFields.some((field) => normalized.includes(field))) {
        throw new Error('Idempotency metadata must not contain credentials or secrets');
      }
      inspect(nested, depth + 1);
    }
  };

  inspect(metadata, 0);
  return serialized;
}

export async function reserveIdempotencyRecord(
  database: ApiDatabase,
  tenantId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000),
): Promise<IdempotencyReservation> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) {
    throw new Error('Idempotency key is invalid');
  }
  if (operation.length < 1 || operation.length > 80) {
    throw new Error('Idempotency operation is invalid');
  }
  if (!/^[a-f0-9]{64}$/.test(requestHash)) {
    throw new Error('Idempotency request hash is invalid');
  }
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('Idempotency expiry is invalid');
  }

  return database.begin(async (transaction) => {
    await transaction.unsafe(
      'DELETE FROM moduqr.idempotency_records ' +
      'WHERE tenant_id = $1::uuid AND expires_at <= now()',
      [tenantId],
    );

    const inserted = await transaction.unsafe(
      'INSERT INTO moduqr.idempotency_records ' +
      '(tenant_id, idempotency_key, operation, request_hash, expires_at) ' +
      'VALUES ($1::uuid, $2, $3, $4, $5) ' +
      'ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING idempotency_key',
      [tenantId, idempotencyKey, operation, requestHash, expiresAt],
    );
    if (inserted.length === 1) return { state: 'created' };

    const existing = await transaction.unsafe(
      'SELECT request_hash AS "requestHash", operation, response_status AS "responseStatus", ' +
      'response_metadata AS "responseMetadata", expires_at AS "expiresAt" ' +
      'FROM moduqr.idempotency_records ' +
      'WHERE tenant_id = $1::uuid AND idempotency_key = $2 FOR UPDATE',
      [tenantId, idempotencyKey],
    ) as Array<{
      requestHash: string;
      operation: string;
      responseStatus: number | null;
      responseMetadata: Record<string, unknown> | string;
      expiresAt: Date;
    }>;

    const record = existing[0];
    if (!record || record.expiresAt.getTime() <= Date.now()) return { state: 'conflict' };
    if (record.requestHash !== requestHash || record.operation !== operation) return { state: 'conflict' };

    let responseMetadata: Record<string, unknown> = {};
    try {
      const decoded: unknown = typeof record.responseMetadata === 'string'
        ? JSON.parse(record.responseMetadata)
        : record.responseMetadata;
      if (decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded)) {
        responseMetadata = decoded as Record<string, unknown>;
      }
    } catch {
      return { state: 'conflict' };
    }

    return {
      state: 'replay',
      responseStatus: record.responseStatus,
      responseMetadata,
    };
  });
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
  if (!Number.isInteger(responseStatus) || responseStatus < 100 || responseStatus > 599) {
    throw new Error('Idempotency response status is invalid');
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey) || operation.length < 1 || operation.length > 80 || !/^[a-f0-9]{64}$/.test(requestHash)) {
    throw new Error('Idempotency completion identity is invalid');
  }
  const serializedMetadata = assertSafeIdempotencyMetadata(responseMetadata);
  const rows = await database.unsafe(
    'UPDATE moduqr.idempotency_records ' +
    'SET response_status = $5, response_metadata = $6::jsonb ' +
    'WHERE tenant_id = $1::uuid AND idempotency_key = $2 AND operation = $3 ' +
    'AND request_hash = $4 AND response_status IS NULL RETURNING idempotency_key',
    [tenantId, idempotencyKey, operation, requestHash, responseStatus, serializedMetadata],
  );
  return rows.length === 1;
}
