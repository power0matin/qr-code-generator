import { z } from 'zod';
import { DESIGN_SCHEMA_VERSION, type QRDesignDocument } from '@moduqr/shared';

const hexOrCss = z.string().min(1).max(128);
const payloadTypeSchema = z.enum(['url', 'text', 'email', 'phone', 'sms', 'whatsapp', 'wifi', 'vcard', 'location', 'event']);
const finderShapeSchema = z.enum(['square', 'rounded', 'circle']);
const gradientSchema = z.object({
  type: z.enum(['linear', 'radial']),
  angle: z.number().finite(),
  stops: z.array(z.object({ offset: z.number().gte(0).lte(1), color: hexOrCss })).min(2).max(8),
});
const logoSchema = z.object({
  dataUrl: z.string().max(3_000_000).nullable(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']).nullable(),
  size: z.number().gte(0.1).lte(0.32),
  padding: z.number().gte(0).lte(20),
  background: hexOrCss,
  radius: z.number().gte(0).lte(100),
  borderWidth: z.number().gte(0).lte(8),
  borderColor: hexOrCss,
  cutout: z.boolean(),
});
const frameSchema = z.object({
  style: z.enum(['none', 'minimal', 'rounded', 'badge', 'label', 'sticker']),
  text: z.string().max(80),
  fontSize: z.number().gte(10).lte(40),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  padding: z.number().gte(8).lte(64),
});

const baseDocumentSchema = {
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  payloadType: payloadTypeSchema,
  payload: z.string().min(1).max(12000),
  presetId: z.string().nullable(),
  favorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

const v1StyleSchema = z.object({
  moduleShape: z.enum(['square', 'rounded', 'extra-rounded', 'dots', 'circle', 'diamond', 'soft-square', 'pixel']),
  finderOuterShape: finderShapeSchema,
  finderInnerShape: finderShapeSchema,
  foreground: hexOrCss,
  background: hexOrCss,
  gradient: gradientSchema.nullable(),
  quietZone: z.number().int().gte(4).lte(16),
  moduleGap: z.number().gte(0).lte(0.35),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']),
  logo: logoSchema,
  frame: frameSchema,
});

const finderOverrideSchema = z.object({
  outerShape: finderShapeSchema.nullable(),
  innerShape: finderShapeSchema.nullable(),
  outerColor: hexOrCss.nullable(),
  innerColor: hexOrCss.nullable(),
});

const v2StyleSchema = z.object({
  moduleShape: z.enum(['square', 'rounded', 'extra-rounded', 'dots', 'circle', 'diamond', 'soft-square', 'pixel', 'connected', 'fluid']),
  finderOuterShape: finderShapeSchema,
  finderInnerShape: finderShapeSchema,
  finderOverrides: z.object({
    topLeft: finderOverrideSchema,
    topRight: finderOverrideSchema,
    bottomLeft: finderOverrideSchema,
  }),
  foreground: hexOrCss,
  background: hexOrCss,
  gradient: gradientSchema.nullable(),
  backgroundGradient: gradientSchema.nullable(),
  quietZone: z.number().int().gte(4).lte(16),
  moduleGap: z.number().gte(0).lte(0.35),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']),
  logo: logoSchema,
  frame: frameSchema,
});

const v1DesignSchema = z.object({
  version: z.literal(1),
  ...baseDocumentSchema,
  style: v1StyleSchema,
});

const v2DesignSchema = z.object({
  version: z.literal(DESIGN_SCHEMA_VERSION),
  ...baseDocumentSchema,
  style: v2StyleSchema,
});

const emptyFinderOverride = {
  outerShape: null,
  innerShape: null,
  outerColor: null,
  innerColor: null,
} as const;

export function parseDesignDocument(value: unknown): QRDesignDocument {
  const version = typeof value === 'object' && value !== null && 'version' in value ? (value as { readonly version?: unknown }).version : undefined;

  if (version === 1) {
    const legacy = v1DesignSchema.parse(value);
    return {
      ...legacy,
      version: DESIGN_SCHEMA_VERSION,
      style: {
        ...legacy.style,
        finderOverrides: {
          topLeft: emptyFinderOverride,
          topRight: emptyFinderOverride,
          bottomLeft: emptyFinderOverride,
        },
        backgroundGradient: null,
      },
    };
  }

  return v2DesignSchema.parse(value);
}
