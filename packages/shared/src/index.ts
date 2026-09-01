export const DESIGN_SCHEMA_VERSION = 2 as const;

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type ModuleShape =
  | 'square'
  | 'rounded'
  | 'extra-rounded'
  | 'dots'
  | 'circle'
  | 'diamond'
  | 'soft-square'
  | 'pixel'
  | 'connected'
  | 'fluid';
export type FinderShape = 'square' | 'rounded' | 'circle';
export type FinderPosition = 'topLeft' | 'topRight' | 'bottomLeft';
export type FrameStyle = 'none' | 'minimal' | 'rounded' | 'badge' | 'label' | 'sticker';
export type GradientType = 'linear' | 'radial';
export type PayloadType =
  | 'url'
  | 'text'
  | 'email'
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'wifi'
  | 'vcard'
  | 'location'
  | 'event';

export interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

export interface GradientDefinition {
  readonly type: GradientType;
  readonly angle: number;
  readonly stops: readonly GradientStop[];
}

export interface FinderOverride {
  readonly outerShape: FinderShape | null;
  readonly innerShape: FinderShape | null;
  readonly outerColor: string | null;
  readonly innerColor: string | null;
}

export interface FinderOverrides {
  readonly topLeft: FinderOverride;
  readonly topRight: FinderOverride;
  readonly bottomLeft: FinderOverride;
}

export interface LogoSettings {
  readonly dataUrl: string | null;
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | null;
  readonly size: number;
  readonly padding: number;
  readonly background: string;
  readonly radius: number;
  readonly borderWidth: number;
  readonly borderColor: string;
  readonly cutout: boolean;
}

export interface FrameSettings {
  readonly style: FrameStyle;
  readonly text: string;
  readonly fontSize: number;
  readonly fontWeight: 400 | 500 | 600 | 700;
  readonly padding: number;
}

export interface QRStyle {
  readonly moduleShape: ModuleShape;
  readonly finderOuterShape: FinderShape;
  readonly finderInnerShape: FinderShape;
  readonly finderOverrides: FinderOverrides;
  readonly foreground: string;
  readonly background: string;
  readonly gradient: GradientDefinition | null;
  readonly backgroundGradient: GradientDefinition | null;
  readonly quietZone: number;
  readonly moduleGap: number;
  readonly errorCorrection: ErrorCorrectionLevel;
  readonly logo: LogoSettings;
  readonly frame: FrameSettings;
}

export interface QRDesignDocument {
  readonly version: typeof DESIGN_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly payloadType: PayloadType;
  readonly payload: string;
  readonly style: QRStyle;
  readonly presetId: string | null;
  readonly favorite: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RenderedQR {
  readonly svg: string;
  readonly matrixSize: number;
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
  readonly modulePixels: number;
}

export interface SafetyIssue {
  readonly code:
    | 'LOW_CONTRAST'
    | 'QUIET_ZONE'
    | 'HIGH_DENSITY'
    | 'SMALL_MODULES'
    | 'LOGO_OBSTRUCTION'
    | 'GRADIENT_CONTRAST'
    | 'FINDER_CONTRAST'
    | 'SHAPE_RISK'
    | 'DECODE_FAILED';
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly fix: string;
  readonly penalty: number;
}

export interface SafetyReport {
  readonly score: number;
  readonly grade: 'Excellent' | 'Good' | 'Risky' | 'Poor';
  readonly issues: readonly SafetyIssue[];
  readonly decoded: boolean | null;
}
