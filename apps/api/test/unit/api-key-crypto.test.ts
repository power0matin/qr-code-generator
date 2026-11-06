import { describe, expect, it } from 'vitest';
import {
  API_KEY_SCOPES,
  createApiKeyMaterial,
  hashApiKeySecret,
  hasApiKeyScope,
  isApiKeyExpired,
  parseApiKeyExpiry,
  parseApiKeyScopes,
  parseApiKeyToken,
  parseBearerAuthorization,
  verifyApiKeySecret,
} from '../../src/api-key-crypto.js';

describe('API key token security', () => {
  it('creates unique 256-bit secrets and stores only a SHA-256 digest', () => {
    const first = createApiKeyMaterial();
    const second = createApiKeyMaterial();

    expect(first.token).toMatch(/^mqk_live_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/);
    expect(first.prefix).toHaveLength(12);
    expect(first.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.token).not.toContain(first.secretHash);
    expect(first.token).not.toBe(second.token);
    expect(verifyApiKeySecret(parseApiKeyToken(first.token)!.secret, first.secretHash)).toBe(true);
    expect(verifyApiKeySecret('wrong-secret', first.secretHash)).toBe(false);
    expect(hashApiKeySecret('same-secret')).toBe(hashApiKeySecret('same-secret'));
  });

  it('rejects malformed tokens and non-canonical base64url values', () => {
    expect(parseApiKeyToken('')).toBeNull();
    expect(parseApiKeyToken('mqk_live_short.short')).toBeNull();
    expect(parseApiKeyToken('mqk_live_!!!!!!!!!!!!.' + 'A'.repeat(43))).toBeNull();
    expect(parseApiKeyToken('mqk_live_' + 'A'.repeat(12) + '.' + 'A'.repeat(43))).toBeNull();
    expect(verifyApiKeySecret('secret', 'not-a-hash')).toBe(false);
  });

  it('accepts only a single strict Bearer authorization value', () => {
    const token = createApiKeyMaterial().token;
    expect(parseBearerAuthorization('Bearer ' + token)?.prefix).toBe(parseApiKeyToken(token)?.prefix);
    expect(parseBearerAuthorization('bearer ' + token)?.prefix).toBe(parseApiKeyToken(token)?.prefix);
    expect(parseBearerAuthorization('Bearer  ' + token)).toBeNull();
    expect(parseBearerAuthorization('Basic ' + token)).toBeNull();
    expect(parseBearerAuthorization(['Bearer ' + token])).toBeNull();
    expect(parseBearerAuthorization('Bearer ' + token + ' extra')).toBeNull();
  });

  it('validates known, unique, non-empty scopes and checks exact grants', () => {
    expect(parseApiKeyScopes(['links:write', 'links:read'])).toEqual(['links:read', 'links:write']);
    expect(parseApiKeyScopes([])).toBeNull();
    expect(parseApiKeyScopes(['links:read', 'links:read'])).toBeNull();
    expect(parseApiKeyScopes(['admin:*'])).toBeNull();
    expect(parseApiKeyScopes(['links:read', 42])).toBeNull();
    expect(parseApiKeyScopes([...API_KEY_SCOPES, 'unknown'])).toBeNull();
    expect(hasApiKeyScope(['links:read'], 'links:read')).toBe(true);
    expect(hasApiKeyScope(['links:read'], 'keys:manage')).toBe(false);
  });

  it('defaults to 90 days and bounds explicit expiry to 365 days', () => {
    const now = new Date('2026-11-07T00:00:00.000Z');
    expect(parseApiKeyExpiry(undefined, now)?.toISOString()).toBe('2027-02-05T00:00:00.000Z');
    expect(parseApiKeyExpiry(null, now)).toBeNull();
    expect(parseApiKeyExpiry('2027-01-01T00:00:00.000Z', now)?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(parseApiKeyExpiry('2026-11-06T23:59:59.000Z', now)).toBeUndefined();
    expect(parseApiKeyExpiry('2027-11-08T00:00:00.000Z', now)).toBeUndefined();
    expect(parseApiKeyExpiry('not-a-date', now)).toBeUndefined();
    expect(isApiKeyExpired(null, now)).toBe(false);
    expect(isApiKeyExpired(new Date('2026-11-06T23:59:59.000Z'), now)).toBe(true);
  });
});
