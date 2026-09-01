import type { PayloadType } from '@moduqr/shared';

export interface DetectionResult {
  readonly type: PayloadType;
  readonly confidence: number;
  readonly reason: string;
}

export function detectPayloadType(input: string): DetectionResult {
  const value = input.trim();
  const upper = value.toUpperCase();
  if (/^WIFI:T:/.test(upper)) return { type: 'wifi', confidence: 1, reason: 'WiFi payload signature' };
  if (/^BEGIN:VCARD/.test(upper)) return { type: 'vcard', confidence: 1, reason: 'vCard signature' };
  if (/^BEGIN:VCALENDAR/.test(upper) || /^BEGIN:VEVENT/.test(upper)) return { type: 'event', confidence: 1, reason: 'Calendar signature' };
  if (/^GEO:-?\d/.test(upper)) return { type: 'location', confidence: 0.99, reason: 'geo URI' };
  if (/^MAILTO:/i.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { type: 'email', confidence: 0.96, reason: 'Email address' };
  if (/^TEL:/i.test(value) || /^\+?[\d\s().-]{7,}$/.test(value)) return { type: 'phone', confidence: 0.9, reason: 'Phone number' };
  if (/^SMS:/i.test(value)) return { type: 'sms', confidence: 1, reason: 'SMS URI' };
  if (/^(https?:\/\/)?(wa\.me|api\.whatsapp\.com)\//i.test(value)) return { type: 'whatsapp', confidence: 0.99, reason: 'WhatsApp link' };
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return { type: 'url', confidence: 0.98, reason: 'Web URL' };
  } catch {
    // Plain text is the safe fallback.
  }
  return { type: 'text', confidence: 0.55, reason: 'No structured payload signature detected' };
}

function unescapeWifi(value: string): string {
  return value.replace(/\\([\\;,:\"])/g, '$1');
}

function parseWifiFields(input: string): Map<string, string> {
  const body = input.replace(/^WIFI:/i, '').replace(/;;$/, '');
  const fields = new Map<string, string>();
  let current = '';
  let escaped = false;
  const parts: string[] = [];
  for (const char of body) {
    if (escaped) {
      current += `\\${char}`;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === ';') {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  for (const part of parts) {
    const separator = part.indexOf(':');
    if (separator > 0) fields.set(part.slice(0, separator), unescapeWifi(part.slice(separator + 1)));
  }
  return fields;
}

function iCalDateToLocalInput(value: string): string {
  const compact = value.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(?:\d{2})?Z?$/);
  if (compact) {
    const [, year, month, day, hour, minute] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
  const dateOnly = value.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${year}-${month}-${day}T00:00`;
  }
  return value.trim();
}

function unescapeICal(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

export interface ParsedStructuredPayload {
  readonly type: PayloadType;
  readonly fields: Readonly<Record<string, string | boolean | number>>;
}

export function parseStructuredPayload(input: string): ParsedStructuredPayload {
  const detection = detectPayloadType(input);
  const value = input.trim();
  switch (detection.type) {
    case 'wifi': {
      const fields = parseWifiFields(value);
      const securityRaw = fields.get('T') ?? 'WPA';
      const security = securityRaw === 'WEP' || securityRaw === 'nopass' ? securityRaw : 'WPA';
      return { type: 'wifi', fields: { ssid: fields.get('S') ?? '', password: fields.get('P') ?? '', security, hidden: fields.get('H') === 'true' } };
    }
    case 'email': {
      const mail = value.replace(/^mailto:/i, '');
      const [address = '', query = ''] = mail.split('?', 2);
      const params = new URLSearchParams(query);
      return { type: 'email', fields: { email: address, subject: params.get('subject') ?? '', body: params.get('body') ?? '' } };
    }
    case 'phone':
      return { type: 'phone', fields: { phone: value.replace(/^tel:/i, '') } };
    case 'sms': {
      const sms = value.replace(/^sms:/i, '');
      const [phone = '', query = ''] = sms.split('?', 2);
      return { type: 'sms', fields: { phone, message: new URLSearchParams(query).get('body') ?? '' } };
    }
    case 'whatsapp': {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      const phone = url.hostname.toLowerCase() === 'api.whatsapp.com' ? url.searchParams.get('phone') ?? '' : url.pathname.replace(/^\//, '');
      return { type: 'whatsapp', fields: { phone, message: url.searchParams.get('text') ?? '' } };
    }
    case 'location': {
      const match = value.match(/^geo:([^,]+),([^?]+)(?:\?q=[^(]+\((.*)\))?$/i);
      return { type: 'location', fields: { latitude: Number(match?.[1] ?? 0), longitude: Number(match?.[2] ?? 0), label: match?.[3] ? decodeURIComponent(match[3]) : '' } };
    }
    case 'vcard': {
      const field = (name: string): string => value.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'im'))?.[1]?.replace(/\\n/gi, '\n').replace(/\\([;,\\])/g, '$1') ?? '';
      const names = field('N').split(';');
      return { type: 'vcard', fields: { firstName: names[1] ?? '', lastName: names[0] ?? '', organization: field('ORG'), jobTitle: field('TITLE'), phone: field('TEL'), email: field('EMAIL'), website: field('URL') } };
    }
    case 'event':
      return { type: 'event', fields: { title: unescapeICal(value.match(/^SUMMARY:(.*)$/im)?.[1] ?? 'Event'), start: iCalDateToLocalInput(value.match(/^DTSTART(?:;[^:]*)?:(.*)$/im)?.[1] ?? ''), end: iCalDateToLocalInput(value.match(/^DTEND(?:;[^:]*)?:(.*)$/im)?.[1] ?? ''), location: unescapeICal(value.match(/^LOCATION:(.*)$/im)?.[1] ?? ''), description: unescapeICal(value.match(/^DESCRIPTION:(.*)$/im)?.[1] ?? '') } };
    case 'url':
      return { type: 'url', fields: { url: value } };
    case 'text':
      return { type: 'text', fields: { text: value } };
  }
  throw new Error(`Unsupported detected payload type: ${String(detection.type)}`);
}
