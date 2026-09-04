import { describe, expect, it } from 'vitest';
import { detectPayloadType, parseStructuredPayload, serializePayload } from './index';

function localDateTimeFromUtc(year: number, month: number, day: number, hour: number, minute: number): string {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe('payload serialization', () => {
  it('serializes URL', () => expect(serializePayload('url', { url: 'https://example.com' })).toBe('https://example.com'));
  it('rejects non-http URL schemes in URL mode', () => expect(() => serializePayload('url', { url: 'javascript:alert(1)' })).toThrow());
  it('rejects phone input without digits', () => expect(() => serializePayload('phone', { phone: 'call me' })).toThrow());
  it('rejects malformed or misplaced phone plus signs', () => {
    expect(() => serializePayload('phone', { phone: '++15550100' })).toThrow();
    expect(() => serializePayload('phone', { phone: '155+50100' })).toThrow();
  });
  it('normalizes a valid international phone number', () => {
    expect(serializePayload('phone', { phone: '+1 (555) 010-0000' })).toBe('tel:+15550100000');
  });
  it('serializes WiFi with escaped separators', () => expect(serializePayload('wifi', { ssid: 'Cafe;5G', password: 'a:b', security: 'WPA', hidden: false })).toContain('S:Cafe\\;5G;P:a\\:b'));
  it('requires a password for protected WiFi modes', () => {
    expect(() => serializePayload('wifi', { ssid: 'Home', password: '', security: 'WPA', hidden: false })).toThrow();
    expect(() => serializePayload('wifi', { ssid: 'Legacy', password: '', security: 'WEP', hidden: false })).toThrow();
  });
  it('never includes a password field for open WiFi', () => {
    expect(serializePayload('wifi', { ssid: 'Guest', password: 'should-not-leak', security: 'nopass', hidden: false })).toBe('WIFI:T:nopass;S:Guest;H:false;;');
  });
  it('serializes vCard with CRLF', () => expect(serializePayload('vcard', { firstName: 'Ada', lastName: 'Lovelace', organization: '', title: '', phone: '', email: '', website: '' })).toContain('BEGIN:VCARD\r\n'));
  it('uses organization as FN for organization-only vCards', () => {
    const card = serializePayload('vcard', { firstName: '', lastName: '', organization: 'ModuQR Labs', title: '', phone: '', email: 'hello@example.com', website: '' });
    expect(card).toContain('FN:ModuQR Labs');
  });
  it('rejects malformed optional vCard phone values', () => {
    expect(() => serializePayload('vcard', { firstName: 'Ada', lastName: '', organization: '', title: '', phone: 'not-a-phone', email: '', website: '' })).toThrow();
  });
  it('rejects inverted or zero-duration events', () => {
    expect(() => serializePayload('event', { title: 'Bad', start: '2026-09-02T10:00', end: '2026-09-02T09:00', location: '', description: '' })).toThrow();
    expect(() => serializePayload('event', { title: 'Zero', start: '2026-09-02T10:00', end: '2026-09-02T10:00', location: '', description: '' })).toThrow();
  });
});

describe('smart detect', () => {
  it('detects WiFi', () => expect(detectPayloadType('WIFI:T:WPA;S:Home;P:test;;').type).toBe('wifi'));
  it('detects URL', () => expect(detectPayloadType('https://moduqr.dev').type).toBe('url'));
  it('parses WiFi into editable fields', () => expect(parseStructuredPayload('WIFI:t:wpa;s:Cafe\\;5G;p:a\\:b;h:TRUE;;').fields).toMatchObject({ ssid: 'Cafe;5G', password: 'a:b', security: 'WPA', hidden: true }));
  it('normalizes open WiFi payloads without retaining a password', () => expect(parseStructuredPayload('WIFI:T:nopass;S:Guest;P:unexpected;;').fields).toMatchObject({ ssid: 'Guest', password: '', security: 'nopass' }));
  it('parses WhatsApp API links', () => expect(parseStructuredPayload('https://api.whatsapp.com/send?phone=15550100&text=Hello').fields).toMatchObject({ phone: '15550100', message: 'Hello' }));
  it('parses UTC iCalendar dates into the current local timezone', () => {
    const parsed = parseStructuredPayload('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Launch\r\nDTSTART:20260902T103000Z\r\nDTEND:20260902T113000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
    expect(parsed).toMatchObject({
      type: 'event',
      fields: {
        title: 'Launch',
        start: localDateTimeFromUtc(2026, 9, 2, 10, 30),
        end: localDateTimeFromUtc(2026, 9, 2, 11, 30),
      },
    });
  });
  it('unfolds folded vCard and iCalendar content lines before parsing', () => {
    const card = parseStructuredPayload('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;;\r\nORG:ModuQR\r\n Labs\r\nEND:VCARD');
    expect(card.fields).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', organization: 'ModuQRLabs' });

    const event = parseStructuredPayload('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Phase 2\r\n Launch\r\nDTSTART:20260902T103000Z\r\nDTEND:20260902T113000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
    expect(event.fields).toMatchObject({ title: 'Phase 2Launch' });
  });
  it('parses geolocation labels without requiring parentheses and tolerates malformed percent encoding', () => {
    const malformed = parseStructuredPayload('geo:35.6892,51.3890?q=%E0%A4%A');
    expect(malformed.fields).toMatchObject({ latitude: 35.6892, longitude: 51.389, label: '�%A' });
    const plain = parseStructuredPayload('geo:35.6892,51.3890?q=Tehran');
    expect(plain.fields).toMatchObject({ latitude: 35.6892, longitude: 51.389, label: 'Tehran' });
  });

  it('round-trips geolocation labels containing parentheses', () => {
    const payload = serializePayload('location', { latitude: 35.6892, longitude: 51.389, label: 'Office (HQ)' });
    expect(payload).toContain('Office%20%28HQ%29');
    expect(parseStructuredPayload(payload).fields).toMatchObject({ label: 'Office (HQ)' });
  });
});
