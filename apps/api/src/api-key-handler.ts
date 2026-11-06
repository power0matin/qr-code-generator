import type { IncomingMessage, ServerResponse } from 'node:http';
import { authenticateApiKey } from './api-key-auth.js';
import {
  parseApiKeyExpiry,
  parseApiKeyScopes,
} from './api-key-crypto.js';
import { consumeApiKeyRateLimit } from './api-rate-limit.js';
import {
  createTenantApiKey,
  listTenantApiKeys,
  revokeTenantApiKey,
  rotateTenantApiKey,
} from './api-key-service.js';
import type { ApiDatabase } from './database-client.js';

const collectionPath = '/v1/api-keys';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBodyBytes = 8_192;
const rateLimitPerMinute = 60;

type RequestBody = Record<string, unknown>;

class BodyTooLargeError extends Error {}
class InvalidBodyError extends Error {}
class UnsupportedContentTypeError extends Error {}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: Readonly<Record<string, unknown>>,
  requestId: string,
): void {
  const body = JSON.stringify({ ...payload, requestId });
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('pragma', 'no-cache');
  response.setHeader('vary', 'Authorization');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-request-id', requestId);
  response.setHeader('content-length', String(Buffer.byteLength(body)));
  response.end(body);
}

async function readJsonBody(request: IncomingMessage): Promise<RequestBody> {
  const contentType = request.headers['content-type'];
  if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new UnsupportedContentTypeError();
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maximumBodyBytes) {
      request.resume();
      throw new BodyTooLargeError();
    }
    chunks.push(buffer);
  }

  if (totalBytes === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new InvalidBodyError();
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidBodyError();
  }
  return parsed as RequestBody;
}

function hasOnlyAllowedFields(body: RequestBody, allowed: readonly string[]): boolean {
  return Object.keys(body).every((key) => allowed.includes(key));
}

function setRateLimitHeaders(
  response: ServerResponse,
  limit: number,
  remaining: number,
  resetAt: Date,
): void {
  response.setHeader('ratelimit-limit', String(limit));
  response.setHeader('ratelimit-remaining', String(remaining));
  response.setHeader('ratelimit-reset', String(Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1_000))));
}

export async function handleApiKeyRequest(
  database: ApiDatabase,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<void> {
  let pathname: string;
  try {
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  } catch {
    sendJson(response, 400, { error: { code: 'invalid_request', message: 'Invalid request path' } }, requestId);
    return;
  }

  const match = /^\/v1\/api-keys(?:\/([^/]+)(?:\/(rotate))?)?$/.exec(pathname);
  if (!match || (match[1] && !uuidPattern.test(match[1]))) {
    sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } }, requestId);
    return;
  }

  const keyId = match[1]?.toLowerCase();
  const rotate = match[2] === 'rotate';
  const method = request.method ?? 'UNKNOWN';
  const allowedMethod = !keyId
    ? method === 'GET' || method === 'POST'
    : rotate ? method === 'POST' : method === 'DELETE';

  if (!allowedMethod) {
    response.setHeader('allow', keyId ? (rotate ? 'POST' : 'DELETE') : 'GET, POST');
    sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed' } }, requestId);
    return;
  }

  const identity = await authenticateApiKey(database, request.headers);
  if (!identity) {
    response.setHeader('www-authenticate', 'Bearer');
    sendJson(response, 401, { error: { code: 'unauthorized', message: 'A valid API key is required' } }, requestId);
    return;
  }

  const rateLimit = await consumeApiKeyRateLimit(database, identity.id, rateLimitPerMinute);
  setRateLimitHeaders(response, rateLimit.limit, rateLimit.remaining, rateLimit.resetAt);
  if (!rateLimit.allowed) {
    response.setHeader('retry-after', String(Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1_000))));
    sendJson(response, 429, { error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded' } }, requestId);
    return;
  }

  if (!identity.scopes.includes('keys:manage')) {
    sendJson(response, 403, { error: { code: 'insufficient_scope', message: 'The API key lacks keys:manage scope' } }, requestId);
    return;
  }

  if (!keyId && method === 'GET') {
    const keys = await listTenantApiKeys(database, identity.tenantId);
    sendJson(response, 200, { data: keys }, requestId);
    return;
  }

  if (!keyId && method === 'POST') {
    if (request.headers['idempotency-key'] !== undefined) {
      sendJson(response, 400, {
        error: {
          code: 'idempotency_not_supported_for_secret_issuance',
          message: 'Secret issuance cannot be replayed; store the returned key immediately',
        },
      }, requestId);
      return;
    }

    let body: RequestBody;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const statusCode = error instanceof BodyTooLargeError ? 413 :
        error instanceof UnsupportedContentTypeError ? 415 : 400;
      const code = error instanceof BodyTooLargeError ? 'body_too_large' :
        error instanceof UnsupportedContentTypeError ? 'unsupported_media_type' : 'invalid_json';
      sendJson(response, statusCode, { error: { code, message: 'Request body is invalid' } }, requestId);
      return;
    }

    if (!hasOnlyAllowedFields(body, ['scopes', 'expiresAt'])) {
      sendJson(response, 400, { error: { code: 'invalid_fields', message: 'Only scopes and expiresAt are accepted' } }, requestId);
      return;
    }

    const scopes = parseApiKeyScopes(body['scopes']);
    const expiresAt = parseApiKeyExpiry(body['expiresAt']);
    if (!scopes || expiresAt === undefined) {
      sendJson(response, 400, { error: { code: 'invalid_key_policy', message: 'Scopes or expiry are invalid' } }, requestId);
      return;
    }

    const issued = await createTenantApiKey(database, identity.tenantId, scopes, expiresAt);
    sendJson(response, 201, { data: issued }, requestId);
    return;
  }

  if (keyId && rotate && method === 'POST') {
    if (request.headers['idempotency-key'] !== undefined) {
      sendJson(response, 400, {
        error: {
          code: 'idempotency_not_supported_for_secret_issuance',
          message: 'Secret issuance cannot be replayed; store the returned key immediately',
        },
      }, requestId);
      return;
    }

    let body: RequestBody;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const statusCode = error instanceof BodyTooLargeError ? 413 :
        error instanceof UnsupportedContentTypeError ? 415 : 400;
      const code = error instanceof BodyTooLargeError ? 'body_too_large' :
        error instanceof UnsupportedContentTypeError ? 'unsupported_media_type' : 'invalid_json';
      sendJson(response, statusCode, { error: { code, message: 'Request body is invalid' } }, requestId);
      return;
    }

    if (!hasOnlyAllowedFields(body, ['scopes', 'expiresAt'])) {
      sendJson(response, 400, { error: { code: 'invalid_fields', message: 'Only scopes and expiresAt are accepted' } }, requestId);
      return;
    }

    const scopes = body['scopes'] === undefined ? undefined : parseApiKeyScopes(body['scopes']);
    const expiresAt = parseApiKeyExpiry(body['expiresAt']);
    if ((body['scopes'] !== undefined && !scopes) || expiresAt === undefined) {
      sendJson(response, 400, { error: { code: 'invalid_key_policy', message: 'Scopes or expiry are invalid' } }, requestId);
      return;
    }

    const issued = await rotateTenantApiKey(database, identity.tenantId, keyId, scopes, expiresAt);
    if (!issued) {
      sendJson(response, 404, { error: { code: 'not_found', message: 'API key not found' } }, requestId);
      return;
    }
    sendJson(response, 201, { data: issued }, requestId);
    return;
  }

  if (keyId && !rotate && method === 'DELETE') {
    const revoked = await revokeTenantApiKey(database, identity.tenantId, keyId);
    if (!revoked) {
      sendJson(response, 404, { error: { code: 'not_found', message: 'API key not found' } }, requestId);
      return;
    }
    sendJson(response, 200, { data: { revoked: true } }, requestId);
    return;
  }

  sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } }, requestId);
}
