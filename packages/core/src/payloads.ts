import { z } from 'zod';
import type { PayloadType } from '@moduqr/shared';

const nonEmpty = z.string().trim().min(1).max(12_000);
const httpUrl = z.string().trim().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'Use an http:// or https:// URL.');
const phone = z.string().trim().min(1).refine((value) => value.replace(/\D/g, '').length >= 3, 'Enter a valid phone number.');
const optionalEmail = z.union([z.literal(''), z.string().trim().email()]);
const optionalHttpUrl = z.union([z.literal(''), httpUrl]);

export const payloadInputSchemas = {
  url: z.object({ url: httpUrl }),
  text: z.object({ text: nonEmpty }),
  email: z.object({ email: z.string().trim().email(), subject: z.string().max(2_000), body: z.string().max(8_000) }),
  phone: z.object({ phone }),
  sms: z.object({ phone, message: z.string().max(8_000) }),
  whatsapp: z.object({ phone, message: z.string().max(8_000) }),
  wifi: z.object({ ssid: nonEmpty, password: z.string(), security: z.enum(['WPA', 'WEP', 'nopass']), hidden: z.boolean() }),
  vcard: z.object({ firstName: z.string().max(256), lastName: z.string().max(256), organization: z.string().max(512), title: z.string().max(512), phone: z.string().max(128), email: optionalEmail, website: optionalHttpUrl }).refine((value) => Boolean(value.firstName.trim() || value.lastName.trim() || value.organization.trim()), 'Add a name or organization to the contact.'),
  location: z.object({ latitude: z.number().gte(-90).lte(90), longitude: z.number().gte(-180).lte(180), label: z.string() }),
  event: z.object({ title: nonEmpty, start: nonEmpty.refine((value) => !Number.isNaN(new Date(value).valueOf()), 'Invalid event start.'), end: nonEmpty.refine((value) => !Number.isNaN(new Date(value).valueOf()), 'Invalid event end.'), location: z.string().max(2_000), description: z.string().max(8_000) }),
} as const;

export type PayloadInputs = {
  [K in keyof typeof payloadInputSchemas]: z.infer<(typeof payloadInputSchemas)[K]>;
};

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function escapeICal(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function normalizePhone(value: string): string {
  return value.replace(/[^+\d]/g, '');
}

function compactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function serializePayload<K extends PayloadType>(type: K, raw: PayloadInputs[K]): string {
  const value = payloadInputSchemas[type].parse(raw) as PayloadInputs[K];
  switch (type) {
    case 'url':
      return (value as PayloadInputs['url']).url;
    case 'text':
      return (value as PayloadInputs['text']).text;
    case 'email': {
      const input = value as PayloadInputs['email'];
      const params = new URLSearchParams();
      if (input.subject) params.set('subject', input.subject);
      if (input.body) params.set('body', input.body);
      const query = params.toString();
      return `mailto:${input.email}${query ? `?${query}` : ''}`;
    }
    case 'phone':
      return `tel:${normalizePhone((value as PayloadInputs['phone']).phone)}`;
    case 'sms': {
      const input = value as PayloadInputs['sms'];
      return `sms:${normalizePhone(input.phone)}${input.message ? `?body=${encodeURIComponent(input.message)}` : ''}`;
    }
    case 'whatsapp': {
      const input = value as PayloadInputs['whatsapp'];
      const phone = normalizePhone(input.phone).replace(/^\+/, '');
      return `https://wa.me/${phone}${input.message ? `?text=${encodeURIComponent(input.message)}` : ''}`;
    }
    case 'wifi': {
      const input = value as PayloadInputs['wifi'];
      return `WIFI:T:${input.security};S:${escapeWifi(input.ssid)};P:${escapeWifi(input.password)};H:${input.hidden ? 'true' : 'false'};;`;
    }
    case 'vcard': {
      const input = value as PayloadInputs['vcard'];
      const fullName = `${input.firstName} ${input.lastName}`.trim();
      const rows = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${escapeVCard(input.lastName)};${escapeVCard(input.firstName)};;;`,
        `FN:${escapeVCard(fullName)}`,
      ];
      if (input.organization) rows.push(`ORG:${escapeVCard(input.organization)}`);
      if (input.title) rows.push(`TITLE:${escapeVCard(input.title)}`);
      if (input.phone) rows.push(`TEL;TYPE=CELL:${normalizePhone(input.phone)}`);
      if (input.email) rows.push(`EMAIL:${escapeVCard(input.email)}`);
      if (input.website) rows.push(`URL:${escapeVCard(input.website)}`);
      rows.push('END:VCARD');
      return rows.join('\r\n');
    }
    case 'location': {
      const input = value as PayloadInputs['location'];
      const label = input.label ? `?q=${input.latitude},${input.longitude}(${encodeURIComponent(input.label)})` : '';
      return `geo:${input.latitude},${input.longitude}${label}`;
    }
    case 'event': {
      const input = value as PayloadInputs['event'];
      if (new Date(input.end).valueOf() < new Date(input.start).valueOf()) {
        throw new Error('Event end must be after its start.');
      }
      const rows = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ModuQR//EN',
        'BEGIN:VEVENT',
        `SUMMARY:${escapeICal(input.title)}`,
        `DTSTART:${compactDate(input.start)}`,
        `DTEND:${compactDate(input.end)}`,
      ];
      if (input.location) rows.push(`LOCATION:${escapeICal(input.location)}`);
      if (input.description) rows.push(`DESCRIPTION:${escapeICal(input.description)}`);
      rows.push('END:VEVENT', 'END:VCALENDAR');
      return rows.join('\r\n');
    }
  }
  throw new Error(`Unsupported payload type: ${String(type)}`);
}

export const defaultPayloadInputs: PayloadInputs = {
  url: { url: 'https://example.com' },
  text: { text: 'Hello from ModuQR' },
  email: { email: 'hello@example.com', subject: '', body: '' },
  phone: { phone: '+1 555 0100' },
  sms: { phone: '+1 555 0100', message: 'Hello' },
  whatsapp: { phone: '+1 555 0100', message: 'Hello' },
  wifi: { ssid: 'My WiFi', password: '', security: 'WPA', hidden: false },
  vcard: { firstName: 'Alex', lastName: 'Morgan', organization: '', title: '', phone: '', email: '', website: '' },
  location: { latitude: 40.7128, longitude: -74.006, label: '' },
  event: { title: 'Event', start: '2026-09-01T09:00', end: '2026-09-01T10:00', location: '', description: '' },
};
