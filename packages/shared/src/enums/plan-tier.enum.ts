export const PAID_PLAN_TIERS = ["STARTER", "PRO"] as const;
export type PaidPlanTier = (typeof PAID_PLAN_TIERS)[number];

export const PLAN_TIERS = ["FREE", ...PAID_PLAN_TIERS] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const BILLING_PERIODICITIES = ["MONTHLY", "PERIOD_YEAR"] as const;
export type BillingPeriodicity = (typeof BILLING_PERIODICITIES)[number];
