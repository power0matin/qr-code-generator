import type { PayloadType } from '@moduqr/shared';

export interface DetectionResult {
  readonly type: PayloadType;
  readonly confidence: number;
  readonly reason: string;
}

function containsWhitespace(value: string): boolean {
  for (const character of value) {
    if (character.trim() === '') return true;
  }
  return false;
}

function isLikelyEmailAddress(value: string): boolean {
  if (value.length === 0 || value.length > 320 || containsWhitespace(value)) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@') || at >= value.length - 1) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || domain.length > 255) return false;
  const lastDot = domain.lastIndexOf('.');
  return lastDot > 0 && lastDot < domain.length - 1;
}

function isLikelyPhoneNumber(value: string): boolean {
  let digits = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (character >= '0' && character <= '9') {
      digits += 1;
      continue;
    }
    if (character === '+' && index === 0) continue;
    if (character === ' ' || character === '(' || character === ')' || character === '.' || character === '-') continue;
    return false;
  }
  return digits >= 7;
}

function isWhatsAppLink(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('wa.me/')
    || lower.startsWith('api.whatsapp.com/')
    || lower.startsWith('http://wa.me/')
    || lower.startsWith('https://wa.me/')
    || lower.startsWith('http://api.whatsapp.com/')
    || lower.startsWith('https://api.whatsapp.com/');
}

export function detectPayloadType(input: string): DetectionResult {
  const value = input.trim();
  const upper = value.toUpperCase();
  if (upper.startsWith('WIFI:T:')) return { type: 'wifi', confidence: 1, reason: 'WiFi payload signature' };
  if (upper.startsWith('BEGIN:VCARD')) return { type: 'vcard', confidence: 1, reason: 'vCard signature' };
  if (upper.startsWith('BEGIN:VCALENDAR') || upper.startsWith('BEGIN:VEVENT')) return { type: 'event', confidence: 1, reason: 'Calendar signature' };
  const geoFirst = upper[4] ?? '';
  if (upper.startsWith('GEO:') && (geoFirst === '-' || (geoFirst >= '0' && geoFirst <= '9'))) return { type: 'location', confidence: 0.99, reason: 'geo URI' };
  if (upper.startsWith('MAILTO:') || isLikelyEmailAddress(value)) return { type: 'email', confidence: 0.96, reason: 'Email address' };
  if (upper.startsWith('TEL:') || isLikelyPhoneNumber(value)) return { type: 'phone', confidence: 0.9, reason: 'Phone number' };
  if (upper.startsWith('SMS:')) return { type: 'sms', confidence: 1, reason: 'SMS URI' };
  if (isWhatsAppLink(value)) return { type: 'whatsapp', confidence: 0.99, reason: 'WhatsApp link' };
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


function extractGeoLabel(qValue: string, latitudeRaw: string, longitudeRaw: string): string {
  if (!qValue) return '';
  const openParen = qValue.indexOf('(');
  if (openParen >= 0 && qValue.endsWith(')')) return qValue.slice(openParen + 1, -1);
  return qValue.startsWith(`${latitudeRaw},${longitudeRaw}`) ? '' : qValue;
}

function unfoldContentLines(value: string): string {
  return value.replace(/\r?\n[ \t]/g, '');
}

function unescapeICal(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function contentLineValue(unfolded: string, property: string): string {
  const expected = property.toUpperCase();
  let start = 0;

  while (start <= unfolded.length) {
    const newline = unfolded.indexOf('\n', start);
    const rawEnd = newline === -1 ? unfolded.length : newline;
    const end = rawEnd > start && unfolded[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd;
    const line = unfolded.slice(start, end);
    const separator = line.indexOf(':');

    if (separator > 0) {
      const header = line.slice(0, separator);
      const parameterStart = header.indexOf(';');
      const name = (parameterStart === -1 ? header : header.slice(0, parameterStart)).toUpperCase();
      if (name === expected) return line.slice(separator + 1);
    }

    if (newline === -1) break;
    start = newline + 1;
  }

  return '';
}

function unescapeVCard(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([;,\\])/g, '$1');
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
      const label = extractGeoLabel(qValue, latitudeRaw, longitudeRaw);
      return { type: 'location', fields: { latitude, longitude, label } };
    }
    case 'vcard': {
      const unfolded = unfoldContentLines(value);
      const field = (name: string): string => unescapeVCard(contentLineValue(unfolded, name));
      const names = field('N').split(';');
      return { type: 'vcard', fields: { firstName: names[1] ?? '', lastName: names[0] ?? '', organization: field('ORG'), jobTitle: field('TITLE'), phone: field('TEL'), email: field('EMAIL'), website: field('URL') } };
    }
    case 'event': {
      const unfolded = unfoldContentLines(value);
      const field = (name: string): string => contentLineValue(unfolded, name);
      return { type: 'event', fields: { title: unescapeICal(field('SUMMARY') || 'Event'), start: iCalDateToLocalInput(field('DTSTART')), end: iCalDateToLocalInput(field('DTEND')), location: unescapeICal(field('LOCATION')), description: unescapeICal(field('DESCRIPTION')) } };
    }
    case 'url':
      return { type: 'url', fields: { url: value } };
    case 'text':
      return { type: 'text', fields: { text: value } };
  }
  throw new Error(`Unsupported detected payload type: ${String(detection.type)}`);
}
