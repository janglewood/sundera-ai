import { DESIGN_STYLES, type DesignStyle } from "../enums/design-style.enum";
import type { PlanTier } from "../enums/plan-tier.enum";

export const FREE_DESIGN_STYLES: readonly DesignStyle[] = [
  "MODERN",
  "SCANDINAVIAN",
  "MINIMALISM",
  "LOFT_INDUSTRIAL",
  "BOHO",
  "JAPANESE",
  "CLASSIC",
  "PROVENCE",
];

// maxGenerations resets each billing period for paid plans (see
// PaymentsService.getCurrentPeriodStart), matching the "N a month" copy; FREE
// has no billing period, so its cap is a one-time lifetime grant instead.
// maxEdits stays a lifetime-per-redesign-chain cap regardless of plan — the
// "up to N edits per redesign" copy was never a time-boxed limit.
// Downloads are allowed on every plan (once signed in) — FREE just gets a
// "sundera.app" watermark baked into the file; paid plans download clean.
export const PLAN_LIMITS = {
  FREE: {
    maxGenerations: 1,
    maxEdits: 1,
    allowedStyles: FREE_DESIGN_STYLES,
    watermarkOnDownload: true,
  },
  STARTER: {
    maxGenerations: 30,
    maxEdits: 5,
    allowedStyles: DESIGN_STYLES,
    watermarkOnDownload: false,
  },
  PRO: {
    maxGenerations: Infinity,
    maxEdits: Infinity,
    allowedStyles: DESIGN_STYLES,
    watermarkOnDownload: false,
  },
} as const;

export function isStyleAllowedForFreePlan(style: DesignStyle): boolean {
  return FREE_DESIGN_STYLES.includes(style);
}

export function isStyleAllowedForPlan(
  style: DesignStyle,
  planTier: PlanTier,
): boolean {
  return (PLAN_LIMITS[planTier].allowedStyles as readonly DesignStyle[]).includes(
    style,
  );
}

export const LOCKED_DESIGN_STYLES: readonly DesignStyle[] = DESIGN_STYLES.filter(
  (style) => !FREE_DESIGN_STYLES.includes(style),
);

export function getLockedStylesForPlan(
  planTier: PlanTier,
): readonly DesignStyle[] {
  const allowedStyles = PLAN_LIMITS[planTier].allowedStyles as readonly DesignStyle[];
  return DESIGN_STYLES.filter((style) => !allowedStyles.includes(style));
}
