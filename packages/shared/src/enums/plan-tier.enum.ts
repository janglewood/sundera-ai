export const PAID_PLAN_TIERS = ["ROOM", "ROOMS", "HOUSE"] as const;
export type PaidPlanTier = (typeof PAID_PLAN_TIERS)[number];

export const PLAN_TIERS = ["FREE", ...PAID_PLAN_TIERS] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
