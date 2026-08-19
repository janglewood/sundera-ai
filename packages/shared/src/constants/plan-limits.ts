import { DESIGN_STYLES, type DesignStyle } from "../enums/design-style.enum";

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

export const PLAN_LIMITS = {
  FREE: {
    maxGenerations: 1,
    maxEdits: 1,
    allowedStyles: FREE_DESIGN_STYLES,
    downloadsAllowed: false,
  },
} as const;

export function isStyleAllowedForFreePlan(style: DesignStyle): boolean {
  return FREE_DESIGN_STYLES.includes(style);
}

export const LOCKED_DESIGN_STYLES: readonly DesignStyle[] = DESIGN_STYLES.filter(
  (style) => !FREE_DESIGN_STYLES.includes(style),
);
