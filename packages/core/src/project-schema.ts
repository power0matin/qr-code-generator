import { z } from 'zod';
import { DESIGN_SCHEMA_VERSION, type QRDesignDocument } from '@moduqr/shared';

const hexOrCss = z.string().min(1).max(128);
const designSchema = z.object({
  version: z.literal(DESIGN_SCHEMA_VERSION),
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  payloadType: z.enum(['url', 'text', 'email', 'phone', 'sms', 'whatsapp', 'wifi', 'vcard', 'location', 'event']),
  payload: z.string().min(1).max(12000),
  style: z.object({
    moduleShape: z.enum(['square', 'rounded', 'extra-rounded', 'dots', 'circle', 'diamond', 'soft-square', 'pixel']),
    finderOuterShape: z.enum(['square', 'rounded', 'circle']),
    finderInnerShape: z.enum(['square', 'rounded', 'circle']),
    foreground: hexOrCss,
    background: hexOrCss,
    gradient: z.object({ type: z.enum(['linear', 'radial']), angle: z.number().finite(), stops: z.array(z.object({ offset: z.number().gte(0).lte(1), color: hexOrCss })).min(2).max(8) }).nullable(),
    quietZone: z.number().int().gte(4).lte(16),
    moduleGap: z.number().gte(0).lte(0.35),
    errorCorrection: z.enum(['L', 'M', 'Q', 'H']),
    logo: z.object({ dataUrl: z.string().max(3_000_000).nullable(), mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']).nullable(), size: z.number().gte(0.1).lte(0.32), padding: z.number().gte(0).lte(20), background: hexOrCss, radius: z.number().gte(0).lte(100), borderWidth: z.number().gte(0).lte(8), borderColor: hexOrCss, cutout: z.boolean() }),
    frame: z.object({ style: z.enum(['none', 'minimal', 'rounded', 'badge', 'label', 'sticker']), text: z.string().max(80), fontSize: z.number().gte(10).lte(40), fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]), padding: z.number().gte(8).lte(64) }),
  }),
  presetId: z.string().nullable(),
  favorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export function parseDesignDocument(value: unknown): QRDesignDocument {
  return designSchema.parse(value);
}
