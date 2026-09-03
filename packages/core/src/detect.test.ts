import { describe, expect, it } from 'vitest';
import { detectPayloadType, parseStructuredPayload } from './detect';

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

  it('extracts geo labels without a backtracking regular expression', () => {
    expect(parseStructuredPayload('geo:40.7128,-74.006?q=40.7128%2C-74.006(Home)').fields['label']).toBe('Home');
    expect(parseStructuredPayload('geo:40.7128,-74.006?q=Coffee%20Shop').fields['label']).toBe('Coffee Shop');
  });

  it('handles adversarial geo labels in linear string operations', () => {
    const q = `(${`a(`.repeat(50_000)}`;
    const parsed = parseStructuredPayload(`geo:1,2?q=${encodeURIComponent(q)}`);
    expect(parsed.type).toBe('location');
    expect(parsed.fields['label']).toBe(q);
  });

  it('parses vCard and iCalendar properties with parameters using linear line scanning', () => {
    const card = parseStructuredPayload('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;;\r\nTEL;TYPE=CELL:+14155552671\r\nEMAIL;TYPE=INTERNET:ada@example.com\r\nEND:VCARD');
    expect(card.type).toBe('vcard');
    expect(card.fields['firstName']).toBe('Ada');
    expect(card.fields['lastName']).toBe('Lovelace');
    expect(card.fields['phone']).toBe('+14155552671');
    expect(card.fields['email']).toBe('ada@example.com');

    const event = parseStructuredPayload('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Launch\r\nDTSTART;TZID=Europe/Amsterdam:20260902T103000\r\nDTEND;TZID=Europe/Amsterdam:20260902T113000\r\nLOCATION:Studio\r\nEND:VEVENT\r\nEND:VCALENDAR');
    expect(event.type).toBe('event');
    expect(event.fields['title']).toBe('Launch');
    expect(event.fields['start']).toBe('2026-09-02T10:30');
    expect(event.fields['end']).toBe('2026-09-02T11:30');
    expect(event.fields['location']).toBe('Studio');
  });

  it('handles large vCard and iCalendar inputs without backtracking field regexes', () => {
    const filler = Array.from({ length: 20_000 }, (_, index) => `X-${index}:value`).join('\r\n');
    const card = parseStructuredPayload(`BEGIN:VCARD\r\n${filler}\r\nN:Lovelace;Ada;;;;\r\nEND:VCARD`);
    expect(card.fields['firstName']).toBe('Ada');

    const event = parseStructuredPayload(`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n${filler}\r\nSUMMARY:Large event\r\nDTSTART:20260902T103000\r\nDTEND:20260902T113000\r\nEND:VEVENT\r\nEND:VCALENDAR`);
    expect(event.fields['title']).toBe('Large event');
  });

  it('preserves phone and WhatsApp detection', () => {
    expect(detectPayloadType('+1 (415) 555-2671').type).toBe('phone');
    expect(detectPayloadType('https://wa.me/14155552671').type).toBe('whatsapp');
  });
});
