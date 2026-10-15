import type {
  CreateCheckoutResponse,
  PaidPlanTier,
  PurchaseResponse,
  TokensResponse,
} from "@sundera/shared";
import { apiGet, apiPostJson } from "./api-client";

export function createCheckout(
  planTier: PaidPlanTier,
): Promise<CreateCheckoutResponse> {
  return apiPostJson<CreateCheckoutResponse>("/payments/checkout", {
    planTier,
  });
}

export function getMyPurchase(): Promise<PurchaseResponse> {
  return apiGet<PurchaseResponse>("/payments/purchase");
}

export function getMyTokens(): Promise<TokensResponse> {
  return apiGet<TokensResponse>("/tokens");
}
