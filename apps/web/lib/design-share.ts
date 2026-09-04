'use client';

import { parseDesignDocument } from '@moduqr/core';
import { DESIGN_SCHEMA_VERSION, type QRStyle } from '@moduqr/shared';

const SHARE_KEY = 'design';
const SHARE_FORMAT_VERSION = 1;
const MAX_SHARE_BYTES = 24_000;

interface DesignSharePayload {
  readonly v: typeof SHARE_FORMAT_VERSION;
  readonly presetId: string | null;
  readonly style: QRStyle;
}

export interface SharedDesign {
  readonly presetId: string | null;
  readonly style: QRStyle;
}

function withoutEmbeddedLogo(style: QRStyle): QRStyle {
  return {
    ...style,
    logo: { ...style.logo, dataUrl: null, mimeType: null },
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 40_000) throw new Error('Shared design encoding is invalid.');
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function validateSharedStyle(style: unknown, presetId: unknown): SharedDesign {
  const now = new Date().toISOString();
  const document = parseDesignDocument({
    version: DESIGN_SCHEMA_VERSION,
    id: 'shared-design',
    name: 'Shared design',
    payloadType: 'url',
    payload: 'https://example.com',
    style,
    presetId: typeof presetId === 'string' && presetId.length <= 128 ? presetId : null,
    favorite: false,
    tags: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });
  return { style: withoutEmbeddedLogo(document.style), presetId: document.presetId };
}

export function createDesignShareUrl(style: QRStyle, presetId: string | null): string {
  const safe = validateSharedStyle(withoutEmbeddedLogo(style), presetId);
  const payload: DesignSharePayload = { v: SHARE_FORMAT_VERSION, presetId: safe.presetId, style: safe.style };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > MAX_SHARE_BYTES) throw new Error('This design is too large to share in a URL.');
  const url = new URL(window.location.href);
  url.pathname = '/generator';
  url.search = '';
  url.hash = `${SHARE_KEY}=${bytesToBase64Url(bytes)}`;
  return url.toString();
}

export function readDesignShareFromHash(hash: string): SharedDesign | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized) return null;
  const params = new URLSearchParams(normalized);
  const encoded = params.get(SHARE_KEY);
  if (!encoded) return null;
  const bytes = base64UrlToBytes(encoded);
  if (bytes.byteLength > MAX_SHARE_BYTES) throw new Error('Shared design is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error('Shared design JSON is invalid.');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Shared design payload is invalid.');
  const candidate = parsed as { readonly v?: unknown; readonly presetId?: unknown; readonly style?: unknown };
  if (candidate.v !== SHARE_FORMAT_VERSION) throw new Error('Shared design version is not supported.');
  return validateSharedStyle(candidate.style, candidate.presetId);
}
