import { DESIGN_STYLES, type DesignStyle } from "../enums/design-style.enum";
import { PAID_PLAN_TIERS, type PaidPlanTier, type PlanTier } from "../enums/plan-tier.enum";

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

export const LOCKED_DESIGN_STYLES: readonly DesignStyle[] = DESIGN_STYLES.filter(
  (style) => !FREE_DESIGN_STYLES.includes(style),
);

export function isStyleAllowedForFreePlan(style: DesignStyle): boolean {
  return FREE_DESIGN_STYLES.includes(style);
}

// Every user gets 2 free tokens on signup; 1 token = 1 generation or 1 edit.
export const FREE_TOKENS = 2;

// One-time packs, in ascending price order. They stack: a user can own several.
export const PACK_TOKENS: Record<PaidPlanTier, number> = {
  ROOM: 10,
  ROOMS: 25,
  HOUSE: 50,
};

export const PLAN_PRICES_USD: Record<PaidPlanTier, number> = {
  ROOM: 5,
  ROOMS: 12,
  HOUSE: 20,
};

export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
  FREE: "Free",
  ROOM: "Room",
  ROOMS: "Few rooms",
  HOUSE: "Whole house",
};

// Highest-price-first — used to pick the single "plan tier" to display for a
// user who has stacked several completed packs.
const TIER_RANK_DESC: readonly PaidPlanTier[] = [...PAID_PLAN_TIERS].sort(
  (a, b) => PLAN_PRICES_USD[b] - PLAN_PRICES_USD[a],
);

export interface Entitlements {
  planTier: PlanTier;
  tokensGranted: number;
  tokensUsed: number;
  tokensBalance: number;
  allowedStyles: readonly DesignStyle[];
  watermarkOnDownload: boolean;
}

// Pure function: no DB access. Caller is responsible for supplying the plan
// tiers of the user's COMPLETED purchases, any ad-hoc bonus token grants,
// and how many non-FAILED generations (including edits) they've used.
// bonusTokens does NOT affect hasPaid — a comp grant alone doesn't unlock
// paid styles or drop the watermark, only a real purchase does.
export function resolveEntitlements(
  completedTiers: readonly PaidPlanTier[],
  tokensUsed: number,
  bonusTokens = 0,
): Entitlements {
  const hasPaid = completedTiers.length > 0;
  const tokensGranted =
    FREE_TOKENS +
    completedTiers.reduce((sum, tier) => sum + PACK_TOKENS[tier], 0) +
    bonusTokens;

  return {
    planTier: TIER_RANK_DESC.find((tier) => completedTiers.includes(tier)) ?? "FREE",
    tokensGranted,
    tokensUsed,
    tokensBalance: Math.max(0, tokensGranted - tokensUsed),
    allowedStyles: hasPaid ? DESIGN_STYLES : FREE_DESIGN_STYLES,
    watermarkOnDownload: !hasPaid,
  };
}

export function isStyleAllowedForEntitlements(
  style: DesignStyle,
  entitlements: Pick<Entitlements, "allowedStyles">,
): boolean {
  return entitlements.allowedStyles.includes(style);
}

export function getLockedStylesForEntitlements(
  entitlements: Pick<Entitlements, "allowedStyles">,
): readonly DesignStyle[] {
  return DESIGN_STYLES.filter((style) => !entitlements.allowedStyles.includes(style));
}

// Client-side convenience: style access depends only on whether the user has
// ever completed a purchase, not on their current token balance — the same
// "hasPaid" check resolveEntitlements uses — so the lightweight TokensResponse
// (which only carries planTier, not the full completed-tiers list) is enough.
export function getLockedStylesForPlanTier(
  planTier: PlanTier,
): readonly DesignStyle[] {
  return planTier === "FREE" ? LOCKED_DESIGN_STYLES : [];
}
