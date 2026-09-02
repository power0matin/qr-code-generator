import { describe, expect, it } from 'vitest';
import { detectPayloadType } from './detect';

describe('payload detection hardening', () => {
  it('detects normal email addresses without a backtracking regular expression', () => {
    expect(detectPayloadType('hello@example.com')).toMatchObject({ type: 'email', confidence: 0.96 });
    expect(detectPayloadType('mailto:hello@example.com')).toMatchObject({ type: 'email', confidence: 0.96 });
  });

  it('rejects malformed email-like input and handles adversarial long input deterministically', () => {
    expect(detectPayloadType('hello @example.com').type).toBe('text');
    const adversarial = `!@!.${'!.'.repeat(50_000)}`;
    expect(detectPayloadType(adversarial).type).toBe('text');
  });

  it('preserves phone and WhatsApp detection', () => {
    expect(detectPayloadType('+1 (415) 555-2671').type).toBe('phone');
    expect(detectPayloadType('https://wa.me/14155552671').type).toBe('whatsapp');
  });
});
