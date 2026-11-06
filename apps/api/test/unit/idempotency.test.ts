import { describe, expect, it } from 'vitest';
import {
  assertSafeIdempotencyMetadata,
  hashIdempotencyRequest,
} from '../../src/idempotency.js';

describe('idempotency metadata boundary', () => {
  it('hashes a canonical request deterministically', () => {
    const canonical = 'POST /v1/links {"destination":"https://example.com"}';
    expect(hashIdempotencyRequest(canonical)).toBe(hashIdempotencyRequest(canonical));
    expect(hashIdempotencyRequest(canonical)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashIdempotencyRequest(canonical)).not.toBe(hashIdempotencyRequest(canonical + ' '));
  });

  it('allows small non-sensitive response metadata', () => {
    expect(assertSafeIdempotencyMetadata({
      resourceId: 'c9c17d59-03bf-4a44-b3bc-876c65e0f3d5',
      created: true,
      counts: [1, 2, 3],
    })).toContain('resourceId');
  });

  it.each([
    { token: 'mqk_live_secret' },
    { apiKey: 'mqk_live_secret' },
    { secretHash: 'digest' },
    { nested: { authorization: 'Bearer secret' } },
    { credentials: { username: 'user', password: 'secret' } },
    { response: { refresh_token: 'secret' } },
  ])('rejects credentials in metadata', (metadata) => {
    expect(() => assertSafeIdempotencyMetadata(metadata)).toThrow();
  });

  it('rejects oversized metadata and excessive nesting', () => {
    expect(() => assertSafeIdempotencyMetadata({ detail: 'x'.repeat(8_000) })).toThrow();
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 10; index += 1) nested = { child: nested };
    expect(() => assertSafeIdempotencyMetadata(nested)).toThrow();
  });
});
