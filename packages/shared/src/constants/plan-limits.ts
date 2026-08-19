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

// maxGenerations/maxEdits are lifetime totals per user, not per-billing-period
// or per-redesign counters — there's no usage-period reset infra yet, so
// STARTER's "30 a month" and "5 edits per redesign" marketing copy is
// enforced here as flat lifetime caps until that's built.
export const PLAN_LIMITS = {
  FREE: {
    maxGenerations: 1,
    maxEdits: 1,
    allowedStyles: FREE_DESIGN_STYLES,
    downloadsAllowed: false,
  },
  STARTER: {
    maxGenerations: 30,
    maxEdits: 5,
    allowedStyles: DESIGN_STYLES,
    downloadsAllowed: true,
  },
  PRO: {
    maxGenerations: Infinity,
    maxEdits: Infinity,
    allowedStyles: DESIGN_STYLES,
    downloadsAllowed: true,
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
