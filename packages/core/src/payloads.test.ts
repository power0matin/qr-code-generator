import { describe, expect, it } from 'vitest';
import { detectPayloadType, parseStructuredPayload, serializePayload } from './index';

describe('payload serialization', () => {
  it('serializes URL', () => expect(serializePayload('url', { url: 'https://example.com' })).toBe('https://example.com'));
  it('rejects non-http URL schemes in URL mode', () => expect(() => serializePayload('url', { url: 'javascript:alert(1)' })).toThrow());
  it('rejects phone input without digits', () => expect(() => serializePayload('phone', { phone: 'call me' })).toThrow());
  it('serializes WiFi with escaped separators', () => expect(serializePayload('wifi', { ssid: 'Cafe;5G', password: 'a:b', security: 'WPA', hidden: false })).toContain('S:Cafe\\;5G;P:a\\:b'));
  it('serializes vCard with CRLF', () => expect(serializePayload('vcard', { firstName: 'Ada', lastName: 'Lovelace', organization: '', title: '', phone: '', email: '', website: '' })).toContain('BEGIN:VCARD\r\n'));
  it('rejects inverted events', () => expect(() => serializePayload('event', { title: 'Bad', start: '2026-09-02T10:00', end: '2026-09-02T09:00', location: '', description: '' })).toThrow());
});

describe('smart detect', () => {
  it('detects WiFi', () => expect(detectPayloadType('WIFI:T:WPA;S:Home;P:test;;').type).toBe('wifi'));
  it('detects URL', () => expect(detectPayloadType('https://moduqr.dev').type).toBe('url'));
  it('parses WiFi into editable fields', () => expect(parseStructuredPayload('WIFI:T:WPA;S:Cafe\\;5G;P:a\\:b;H:true;;').fields).toMatchObject({ ssid: 'Cafe;5G', password: 'a:b', hidden: true }));

  it('parses WhatsApp API links', () => expect(parseStructuredPayload('https://api.whatsapp.com/send?phone=15550100&text=Hello').fields).toMatchObject({ phone: '15550100', message: 'Hello' }));
  it('parses iCalendar dates into editable local inputs', () => {
    const parsed = parseStructuredPayload('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Launch\r\nDTSTART:20260902T103000Z\r\nDTEND:20260902T113000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
    expect(parsed).toMatchObject({ type: 'event', fields: { title: 'Launch', start: '2026-09-02T10:30', end: '2026-09-02T11:30' } });
  });
});
