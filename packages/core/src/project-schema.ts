import { z } from 'zod';
import { DESIGN_SCHEMA_VERSION, type QRDesignDocument } from '@moduqr/shared';
import { decodeBase64DataUrl, inspectRasterDimensions, rasterDimensionsWithinLimits } from './raster';

const hexColor = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, 'Use a 3- or 6-digit hex color.');
const payloadTypeSchema = z.enum(['url', 'text', 'email', 'phone', 'sms', 'whatsapp', 'wifi', 'vcard', 'location', 'event']);
const moduleShapeSchema = z.enum(['square', 'rounded', 'extra-rounded', 'dots', 'circle', 'diamond', 'soft-square', 'pixel', 'connected', 'fluid']);
const v1ModuleShapeSchema = z.enum(['square', 'rounded', 'extra-rounded', 'dots', 'circle', 'diamond', 'soft-square', 'pixel']);
const finderShapeSchema = z.enum(['square', 'rounded', 'circle']);
const logoMimeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

const gradientSchema = z.object({
  type: z.enum(['linear', 'radial']),
  angle: z.number().finite().gte(0).lte(360),
  stops: z.array(z.object({ offset: z.number().gte(0).lte(1), color: hexColor })).min(2).max(8),
});

const SAFE_SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask']);
const RENDERABLE_SVG_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

function hasOnlyLocalSvgReferences(svg: string): boolean {
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) return false;
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(svg)) return false;
  if (/\son[a-z-]+\s*=/i.test(svg) || /\b(?:href|src|xlink:href|style)\s*=/i.test(svg)) return false;
  if (/javascript:|data:text\/html|file:|ftp:|@import|expression\s*\(/i.test(svg)) return false;
  let hasRenderableGeometry = false;
  for (const match of svg.matchAll(/<\/?\s*([A-Za-z][\w:-]*)\b/g)) {
    const tag = match[1]?.toLowerCase() ?? '';
    if (!SAFE_SVG_TAGS.has(tag)) return false;
    if (!match[0]?.startsWith('</') && RENDERABLE_SVG_TAGS.has(tag)) hasRenderableGeometry = true;
  }
  if (!hasRenderableGeometry) return false;
  for (const match of svg.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    const reference = match[2]?.trim() ?? '';
    if (!/^#[A-Za-z_][\w:.-]*$/.test(reference)) return false;
  }
  return true;
}

const MAX_IMPORTED_LOGO_DIMENSION = 4096;
const MAX_IMPORTED_LOGO_PIXELS = 16_000_000;

function importedRasterIsSafe(
  dataUrl: string,
  mimeType: Exclude<z.infer<typeof logoMimeSchema>, 'image/svg+xml'>,
): boolean {
  const bytes = decodeBase64DataUrl(dataUrl);
  if (!bytes) return false;
  const dimensions = inspectRasterDimensions(bytes, mimeType);
  return rasterDimensionsWithinLimits(dimensions, MAX_IMPORTED_LOGO_DIMENSION, MAX_IMPORTED_LOGO_PIXELS);
}

function logoDataMatchesMime(dataUrl: string, mimeType: z.infer<typeof logoMimeSchema>): boolean {
  if (mimeType === 'image/svg+xml') {
    const match = dataUrl.match(/^data:image\/svg\+xml(?:;charset=utf-8)?,(.*)$/is);
    if (!match?.[1]) return false;
    try {
      return hasOnlyLocalSvgReferences(decodeURIComponent(match[1]));
    } catch {
      return false;
    }
  }
  const prefixes: Record<Exclude<z.infer<typeof logoMimeSchema>, 'image/svg+xml'>, RegExp> = {
    'image/png': /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/,
    'image/jpeg': /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/,
    'image/webp': /^data:image\/webp;base64,UklGR[A-Za-z0-9+/]*={0,2}$/,
  };
  const pattern = prefixes[mimeType];
  if (!pattern) return false;
  return pattern.test(dataUrl) && importedRasterIsSafe(dataUrl, mimeType);
}

const logoSchema = z.object({
  dataUrl: z.string().max(3_000_000).nullable(),
  mimeType: logoMimeSchema.nullable(),
  size: z.number().gte(0.1).lte(0.26),
  padding: z.number().gte(0).lte(20),
  background: hexColor,
  radius: z.number().gte(0).lte(100),
  borderWidth: z.number().gte(0).lte(8),
  borderColor: hexColor,
  cutout: z.boolean(),
}).superRefine((value, context) => {
  if (value.dataUrl === null && value.mimeType === null) return;
  if (value.dataUrl === null || value.mimeType === null || !logoDataMatchesMime(value.dataUrl, value.mimeType)) {
    context.addIssue({ code: 'custom', path: ['dataUrl'], message: 'Logo data does not match the declared safe image MIME type.' });
  }
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
  name: z.string().trim().min(1).max(120),
  payloadType: payloadTypeSchema,
  payload: z.string().min(1).max(12_000),
  presetId: z.string().max(128).nullable(),
  favorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

const v1StyleSchema = z.object({
  moduleShape: v1ModuleShapeSchema,
  finderOuterShape: finderShapeSchema,
  finderInnerShape: finderShapeSchema,
  foreground: hexColor,
  background: hexColor,
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
  outerColor: hexColor.nullable(),
  innerColor: hexColor.nullable(),
});

const v2StyleSchema = z.object({
  moduleShape: moduleShapeSchema,
  finderOuterShape: finderShapeSchema,
  finderInnerShape: finderShapeSchema,
  finderOverrides: z.object({
    topLeft: finderOverrideSchema,
    topRight: finderOverrideSchema,
    bottomLeft: finderOverrideSchema,
  }),
  foreground: hexColor,
  background: hexColor,
  gradient: gradientSchema.nullable(),
  backgroundGradient: gradientSchema.nullable(),
  quietZone: z.number().int().gte(4).lte(16),
  moduleGap: z.number().gte(0).lte(0.35),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']),
  logo: logoSchema,
  frame: frameSchema,
});

const regionStyleSchema = z.object({
  color: hexColor.nullable(),
  shape: moduleShapeSchema.nullable(),
});

const v3StyleSchema = v2StyleSchema.extend({
  regionStyles: z.object({
    data: regionStyleSchema,
    timing: regionStyleSchema,
    alignment: regionStyleSchema,
  }),
});

const v1DesignSchema = z.object({ version: z.literal(1), ...baseDocumentSchema, style: v1StyleSchema });
const v2DesignSchema = z.object({ version: z.literal(2), ...baseDocumentSchema, style: v2StyleSchema });
const v3DesignSchema = z.object({
  version: z.literal(DESIGN_SCHEMA_VERSION),
  ...baseDocumentSchema,
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  revision: z.number().int().gte(1).lte(1_000_000),
  style: v3StyleSchema,
});

const emptyFinderOverride = { outerShape: null, innerShape: null, outerColor: null, innerColor: null } as const;
const emptyRegionStyle = { color: null, shape: null } as const;
const emptyRegionStyles = { data: emptyRegionStyle, timing: emptyRegionStyle, alignment: emptyRegionStyle } as const;

function normalizeTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const value = tag.trim().replace(/\s+/g, ' ').slice(0, 32);
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
    if (normalized.length >= 12) break;
  }
  return normalized;
}

export function parseDesignDocument(value: unknown): QRDesignDocument {
  const version = typeof value === 'object' && value !== null && 'version' in value ? (value as { readonly version?: unknown }).version : undefined;

  if (version === 1) {
    const legacy = v1DesignSchema.parse(value);
    return {
      ...legacy,
      version: DESIGN_SCHEMA_VERSION,
      tags: [],
      revision: 1,
      style: {
        ...legacy.style,
        finderOverrides: { topLeft: emptyFinderOverride, topRight: emptyFinderOverride, bottomLeft: emptyFinderOverride },
        regionStyles: emptyRegionStyles,
        backgroundGradient: null,
      },
    };
  }

  if (version === 2) {
    const legacy = v2DesignSchema.parse(value);
    return {
      ...legacy,
      version: DESIGN_SCHEMA_VERSION,
      tags: [],
      revision: 1,
      style: { ...legacy.style, regionStyles: emptyRegionStyles },
    };
  }

  const current = v3DesignSchema.parse(value);
  return { ...current, tags: normalizeTags(current.tags) };
}
