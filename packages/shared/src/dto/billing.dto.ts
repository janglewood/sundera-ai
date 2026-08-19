import type { BillingPeriodicity, PaidPlanTier, PlanTier } from "../enums/plan-tier.enum";
import type { SubscriptionStatus } from "../enums/subscription-status.enum";

export interface CreateCheckoutRequest {
  planTier: PaidPlanTier;
  periodicity: BillingPeriodicity;
}

export interface CreateCheckoutResponse {
  paymentUrl: string;
}

export interface SubscriptionResponse {
  planTier: PlanTier;
  status: SubscriptionStatus | null;
  periodicity: BillingPeriodicity | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}
