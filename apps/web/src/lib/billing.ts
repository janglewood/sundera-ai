import type { CreateCheckoutResponse, PurchaseResponse } from "@sundera/shared";
import { apiGet, apiPostJson } from "./api-client";

export function createCheckout(): Promise<CreateCheckoutResponse> {
  return apiPostJson<CreateCheckoutResponse>("/payments/checkout", {});
}

export function getMyPurchase(): Promise<PurchaseResponse> {
  return apiGet<PurchaseResponse>("/payments/purchase");
}
