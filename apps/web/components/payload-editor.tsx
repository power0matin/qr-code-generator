'use client';

import { detectPayloadType, parseStructuredPayload, serializePayload } from '@moduqr/core';
import type { PayloadType } from '@moduqr/shared';
import { WandSparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStudioStore } from '@/lib/studio-store';

interface FormValues {
  url: string;
  text: string;
  email: string;
  subject: string;
  body: string;
  phone: string;
  message: string;
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
  firstName: string;
  lastName: string;
  organization: string;
  jobTitle: string;
  title: string;
  website: string;
  latitude: number;
  longitude: number;
  label: string;
  start: string;
  end: string;
  location: string;
  description: string;
}

const defaults: FormValues = {
  url: 'https://example.com', text: 'Hello from ModuQR', email: 'hello@example.com', subject: '', body: '', phone: '+15550100', message: 'Hello', ssid: 'My WiFi', password: '', security: 'nopass', hidden: false,
  firstName: 'Alex', lastName: 'Morgan', organization: '', jobTitle: '', title: 'Event', website: '', latitude: 40.7128, longitude: -74.006, label: '', start: '2026-09-01T09:00', end: '2026-09-01T10:00', location: '', description: '',
};

const types: readonly { readonly value: PayloadType; readonly label: string }[] = [
  { value: 'url', label: 'URL' }, { value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' }, { value: 'wifi', label: 'WiFi' }, { value: 'vcard', label: 'vCard' }, { value: 'location', label: 'Location' }, { value: 'event', label: 'Event' },
];

function valuesForStructured(fields: Readonly<Record<string, string | boolean | number>>): Partial<FormValues> {
  const result: Partial<FormValues> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key in defaults) Object.assign(result, { [key]: value });
  }
  return result;
}

function serializeFormValues(type: PayloadType, v: FormValues): string {
  switch (type) {
    case 'url': return serializePayload('url', { url: v.url });
    case 'text': return serializePayload('text', { text: v.text });
    case 'email': return serializePayload('email', { email: v.email, subject: v.subject, body: v.body });
    case 'phone': return serializePayload('phone', { phone: v.phone });
    case 'sms': return serializePayload('sms', { phone: v.phone, message: v.message });
    case 'whatsapp': return serializePayload('whatsapp', { phone: v.phone, message: v.message });
    case 'wifi': return serializePayload('wifi', { ssid: v.ssid, password: v.password, security: v.security, hidden: v.hidden });
    case 'vcard': return serializePayload('vcard', { firstName: v.firstName, lastName: v.lastName, organization: v.organization, title: v.jobTitle, phone: v.phone, email: v.email, website: v.website });
    case 'location': return serializePayload('location', { latitude: Number(v.latitude), longitude: Number(v.longitude), label: v.label });
    case 'event': return serializePayload('event', { title: v.title, start: v.start, end: v.end, location: v.location, description: v.description });
  }
  throw new Error(`Unsupported form payload type: ${String(type)}`);
}

export function PayloadEditor() {
  const payloadType = useStudioStore((state) => state.payloadType);
  const payload = useStudioStore((state) => state.payload);
  const setContent = useStudioStore((state) => state.setContent);
  const { register, getValues, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: defaults, mode: 'onChange' });
  const [smart, setSmart] = useState('');
  const [message, setMessage] = useState('');
  const smartInputRef = useRef<HTMLTextAreaElement>(null);
  const lastWritten = useRef(payload);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writePayload = (type: PayloadType) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const v = getValues();
        const next = serializeFormValues(type, v);
        lastWritten.current = next;
        setContent(type, next);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Check the entered values.');
      }
    }, 120);
  };

  const changeType = (nextType: PayloadType) => {
    if (timer.current) clearTimeout(timer.current);
    reset(defaults);
    try {
      const next = serializeFormValues(nextType, defaults);
      lastWritten.current = next;
      setContent(nextType, next);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not switch content type.');
    }
  };

  const applyStructured = useCallback((value: string, preserveRawPayload = false) => {
    if (!value.trim()) return;
    try {
      const parsed = parseStructuredPayload(value);
      const nextValues = { ...defaults, ...valuesForStructured(parsed.fields) };
      reset(nextValues);
      const nextPayload = preserveRawPayload ? value.trim() : serializeFormValues(parsed.type, nextValues as FormValues);
      lastWritten.current = nextPayload;
      setContent(parsed.type, nextPayload);
      setMessage(`${detectPayloadType(value).reason} detected.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not parse this input.');
    }
  }, [reset, setContent]);

  useEffect(() => {
    let redesign: string | null = null;
    try {
      redesign = window.sessionStorage.getItem('moduqr-redesign-payload');
    } catch {
      redesign = null;
    }
    if (!redesign && payload === lastWritten.current) return;

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (redesign) {
        applyStructured(redesign, true);
        try {
          window.sessionStorage.removeItem('moduqr-redesign-payload');
        } catch {
          // The payload is already applied; storage cleanup is best-effort only.
        }
        return;
      }
      try {
        const parsed = parseStructuredPayload(payload);
        reset({ ...defaults, ...valuesForStructured(parsed.fields) });
        lastWritten.current = payload;
      } catch {
        reset({ ...defaults, text: payload });
      }
    });

    return () => {
      active = false;
    };
  }, [applyStructured, payload, reset]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);


  return <div>
    <div className="panel-header"><div><h2>Content</h2><p>Everything is encoded locally.</p></div></div>
    <div className="field">
      <label htmlFor="smart-input">Smart input</label>
      <textarea ref={smartInputRef} id="smart-input" className="textarea" value={smart} onChange={(event) => setSmart(event.target.value)} placeholder="Paste a URL, WiFi payload, vCard, email…" />
      <button type="button" className="button ghost" onClick={() => applyStructured(smartInputRef.current?.value ?? smart)}><WandSparkles size={15}/> Detect & use</button>
      {message ? <div className={message.includes('detected') ? 'help' : 'error'} role="status">{message}</div> : null}
    </div>
    <div className="divider" />
    <div className="type-grid" aria-label="QR content type">
      {types.map((item) => <button className="type-button" type="button" key={item.value} aria-pressed={payloadType === item.value} onClick={() => changeType(item.value)}>{item.label}</button>)}
    </div>
    <form className="form-stack" onChange={() => writePayload(payloadType)} onSubmit={(event) => event.preventDefault()}>
      {payloadType === 'url' ? <Field label="Website URL" error={errors.url?.message}><input className="input" type="url" {...register('url', { required: 'Enter a URL.' })}/></Field> : null}
      {payloadType === 'text' ? <Field label="Text"><textarea className="textarea" {...register('text', { required: true })}/></Field> : null}
      {payloadType === 'email' ? <><Field label="Email"><input className="input" type="email" {...register('email', { required: true })}/></Field><Field label="Subject"><input className="input" {...register('subject')}/></Field><Field label="Message"><textarea className="textarea" {...register('body')}/></Field></> : null}
      {payloadType === 'phone' ? <Field label="Phone number"><input className="input" inputMode="tel" {...register('phone', { required: true })}/></Field> : null}
      {payloadType === 'sms' || payloadType === 'whatsapp' ? <><Field label="Phone number"><input className="input" inputMode="tel" {...register('phone', { required: true })}/></Field><Field label="Message"><textarea className="textarea" {...register('message')}/></Field></> : null}
      {payloadType === 'wifi' ? <>
        <Field label="Network name (SSID)"><input className="input" {...register('ssid', { required: true })}/></Field>
        <div className="field">
          <label htmlFor="wifi-security">WiFi security</label>
          <select id="wifi-security" className="select" {...register('security')}>
            <option value="WPA">WPA/WPA2/WPA3</option>
            <option value="WEP">WEP</option>
            <option value="nopass">No password</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="wifi-password">WiFi password</label>
          <input id="wifi-password" className="input" type="password" autoComplete="off" aria-describedby="wifi-password-help" {...register('password')}/>
          <span id="wifi-password-help" className="help">Never uploaded or added to a shareable URL.</span>
        </div>
        <label className="field-label"><input type="checkbox" {...register('hidden')}/> Hidden network</label>
      </> : null}
      {payloadType === 'vcard' ? <><Field label="First name"><input className="input" {...register('firstName')}/></Field><Field label="Last name"><input className="input" {...register('lastName')}/></Field><Field label="Organization"><input className="input" {...register('organization')}/></Field><Field label="Title"><input className="input" {...register('jobTitle')}/></Field><Field label="Phone"><input className="input" {...register('phone')}/></Field><Field label="Email"><input className="input" type="email" {...register('email')}/></Field><Field label="Website"><input className="input" {...register('website')}/></Field></> : null}
      {payloadType === 'location' ? <><Field label="Latitude"><input className="input" type="number" step="any" {...register('latitude', { valueAsNumber: true })}/></Field><Field label="Longitude"><input className="input" type="number" step="any" {...register('longitude', { valueAsNumber: true })}/></Field><Field label="Label"><input className="input" {...register('label')}/></Field></> : null}
      {payloadType === 'event' ? <><Field label="Event title"><input className="input" {...register('title', { required: true })}/></Field><Field label="Starts"><input className="input" type="datetime-local" {...register('start')}/></Field><Field label="Ends"><input className="input" type="datetime-local" {...register('end')}/></Field><Field label="Location"><input className="input" {...register('location')}/></Field><Field label="Description"><textarea className="textarea" {...register('description')}/></Field></> : null}
    </form>
  </div>;
}

function Field({ label, error, children }: Readonly<{ label: string; error?: string | undefined; children: React.ReactNode }>) {
  return <label className="field"><span className="field-label">{label}</span>{children}{error ? <span className="error">{error}</span> : null}</label>;
}
