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

// planTier is set as soon as checkout starts (status PENDING) so the row
// exists before the payment webhook lands — mirrors
// PaymentsService.isEntitled on the API side. Only ACTIVE, or CANCELLED
// still within its paid period, actually grants the plan; PENDING/FAILED/
// EXPIRED must read as FREE everywhere the UI decides what a user can do.
export function resolveEntitledPlanTier(
  subscription: Pick<SubscriptionResponse, "planTier" | "status" | "currentPeriodEnd">,
): PlanTier {
  const stillWithinCancelledPeriod =
    subscription.status === "CANCELLED" &&
    subscription.currentPeriodEnd !== null &&
    new Date(subscription.currentPeriodEnd).getTime() > Date.now();
  const isEntitled = subscription.status === "ACTIVE" || stillWithinCancelledPeriod;
  return isEntitled ? subscription.planTier : "FREE";
}
