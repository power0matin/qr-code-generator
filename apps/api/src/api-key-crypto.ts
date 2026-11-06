import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const API_KEY_SCOPES = [
  'links:read',
  'links:write',
  'links:delete',
  'analytics:read',
  'keys:manage',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKeyMaterial {
  readonly prefix: string;
  readonly token: string;
  readonly secretHash: string;
}

export interface ParsedApiKey {
  readonly prefix: string;
  readonly secret: string;
}

const scopeSet = new Set<string>(API_KEY_SCOPES);
const tokenPattern = /^mqk_live_([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{43})$/;

export function createApiKeyMaterial(): ApiKeyMaterial {
  const prefix = randomBytes(9).toString('base64url');
  const secret = randomBytes(32).toString('base64url');
  return {
    prefix,
    token: 'mqk_live_' + prefix + '.' + secret,
    secretHash: hashApiKeySecret(secret),
  };
}

export function hashApiKeySecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function parseApiKeyToken(token: string): ParsedApiKey | null {
  const match = tokenPattern.exec(token);
  if (!match?.[1] || !match[2]) return null;

  const prefixBytes = Buffer.from(match[1], 'base64url');
  const secretBytes = Buffer.from(match[2], 'base64url');
  if (
    prefixBytes.length !== 9 ||
    secretBytes.length !== 32 ||
    prefixBytes.toString('base64url') !== match[1] ||
    secretBytes.toString('base64url') !== match[2]
  ) {
    return null;
  }
  return { prefix: match[1], secret: match[2] };
}

export function parseBearerAuthorization(value: string | string[] | undefined): ParsedApiKey | null {
  if (typeof value !== 'string') return null;
  const match = /^Bearer ([^\s]+)$/i.exec(value);
  return match?.[1] ? parseApiKeyToken(match[1]) : null;
}

export function verifyApiKeySecret(secret: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashApiKeySecret(secret), 'hex');
  const wellFormedHash = /^[a-f0-9]{64}$/.test(storedHash);
  const expected = wellFormedHash ? Buffer.from(storedHash, 'hex') : Buffer.alloc(32);
  const equal = timingSafeEqual(candidate, expected);
  return equal && wellFormedHash;
}

export function parseApiKeyScopes(value: unknown): ApiKeyScope[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > API_KEY_SCOPES.length) return null;
  if (
    !value.every((scope): scope is ApiKeyScope => typeof scope === 'string' && scopeSet.has(scope)) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return [...value].sort() as ApiKeyScope[];
}

export function parseApiKeyExpiry(value: unknown, now = new Date()): Date | null | undefined {
  if (value === undefined) return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1_000);
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) return undefined;

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return undefined;
  const lifetimeMs = expiresAt.getTime() - now.getTime();
  const maximumLifetimeMs = 365 * 24 * 60 * 60 * 1_000;
  if (lifetimeMs <= 0 || lifetimeMs > maximumLifetimeMs) return undefined;
  return expiresAt;
}

export function isApiKeyExpired(expiresAt: Date | string | null, now = new Date()): boolean {
  if (expiresAt === null) return false;
  const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return !Number.isFinite(expiryTime) || expiryTime <= now.getTime();
}
