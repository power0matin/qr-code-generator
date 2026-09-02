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
  if (escaped) current += '\\';
  if (current) parts.push(current);
  for (const part of parts) {
    const separator = part.indexOf(':');
    if (separator > 0) fields.set(part.slice(0, separator).toUpperCase(), unescapeWifi(part.slice(separator + 1)));
  }
  return fields;
}

function localDateInputFromParts(year: number, month: number, day: number, hour: number, minute: number): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function iCalDateToLocalInput(value: string): string {
  const raw = value.trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(?:\d{2})?(Z)?$/);
  if (compact) {
    const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, utcMarker] = compact;
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (utcMarker === 'Z') {
      const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
      return localDateInputFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes());
    }
    return localDateInputFromParts(year, month, day, hour, minute);
  }
  const dateOnly = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${year}-${month}-${day}T00:00`;
  }
  return raw;
}

function unfoldContentLines(value: string): string {
  return value.replace(/\r?\n[ \t]/g, '');
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
      const security = securityRaw === 'WEP' || securityRaw.toLowerCase() === 'nopass' ? (securityRaw.toLowerCase() === 'nopass' ? 'nopass' : 'WEP') : 'WPA';
      return { type: 'wifi', fields: { ssid: fields.get('S') ?? '', password: security === 'nopass' ? '' : fields.get('P') ?? '', security, hidden: (fields.get('H') ?? '').toLowerCase() === 'true' } };
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
      const geoBody = value.replace(/^geo:/i, '');
      const [coordinatePart = '', query = ''] = geoBody.split('?', 2);
      const separator = coordinatePart.indexOf(',');
      const latitudeRaw = separator >= 0 ? coordinatePart.slice(0, separator) : '';
      const longitudeRaw = separator >= 0 ? coordinatePart.slice(separator + 1) : '';
      const latitude = Number(latitudeRaw);
      const longitude = Number(longitudeRaw);
      const qValue = new URLSearchParams(query).get('q') ?? '';
      const labelMatch = qValue.match(/\((.*)\)$/);
      const label = labelMatch?.[1] ?? (qValue && !qValue.startsWith(`${latitudeRaw},${longitudeRaw}`) ? qValue : '');
      return { type: 'location', fields: { latitude, longitude, label } };
    }
    case 'vcard': {
      const unfolded = unfoldContentLines(value);
      const field = (name: string): string => unfolded.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'im'))?.[1]?.replace(/\\n/gi, '\n').replace(/\\([;,\\])/g, '$1') ?? '';
      const names = field('N').split(';');
      return { type: 'vcard', fields: { firstName: names[1] ?? '', lastName: names[0] ?? '', organization: field('ORG'), jobTitle: field('TITLE'), phone: field('TEL'), email: field('EMAIL'), website: field('URL') } };
    }
    case 'event': {
      const unfolded = unfoldContentLines(value);
      return { type: 'event', fields: { title: unescapeICal(unfolded.match(/^SUMMARY:(.*)$/im)?.[1] ?? 'Event'), start: iCalDateToLocalInput(unfolded.match(/^DTSTART(?:;[^:]*)?:(.*)$/im)?.[1] ?? ''), end: iCalDateToLocalInput(unfolded.match(/^DTEND(?:;[^:]*)?:(.*)$/im)?.[1] ?? ''), location: unescapeICal(unfolded.match(/^LOCATION:(.*)$/im)?.[1] ?? ''), description: unescapeICal(unfolded.match(/^DESCRIPTION:(.*)$/im)?.[1] ?? '') } };
    }
    case 'url':
      return { type: 'url', fields: { url: value } };
    case 'text':
      return { type: 'text', fields: { text: value } };
  }
  throw new Error(`Unsupported detected payload type: ${String(detection.type)}`);
}
