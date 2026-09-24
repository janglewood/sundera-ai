import type { PlanTier } from "../enums/plan-tier.enum";
import type { PurchaseStatus } from "../enums/purchase-status.enum";

export interface CreateCheckoutResponse {
  paymentUrl: string;
}

export interface PurchaseResponse {
  planTier: PlanTier;
  status: PurchaseStatus | null;
  purchasedAt: string | null;
}

export function resolveEntitledPlanTier(
  purchase: Pick<PurchaseResponse, "planTier" | "status">,
): PlanTier {
  return purchase.status === "COMPLETED" ? purchase.planTier : "FREE";
}
