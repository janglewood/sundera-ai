import type { PaidPlanTier, PlanTier } from "../enums/plan-tier.enum";
import type { PurchaseStatus } from "../enums/purchase-status.enum";

export interface CreateCheckoutRequest {
  planTier: PaidPlanTier;
}

export interface CreateCheckoutResponse {
  paymentUrl: string;
}

export interface PurchaseResponse {
  planTier: PlanTier;
  status: PurchaseStatus | null;
  purchasedAt: string | null;
}

export interface TokensResponse {
  balance: number;
  granted: number;
  used: number;
  planTier: PlanTier;
}
