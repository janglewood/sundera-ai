import type {
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  SubscriptionResponse,
} from "@sundera/shared";
import { apiGet, apiPostJson } from "./api-client";

export function createCheckout(
  request: CreateCheckoutRequest,
): Promise<CreateCheckoutResponse> {
  return apiPostJson<CreateCheckoutResponse>("/payments/checkout", request);
}

export function getMySubscription(): Promise<SubscriptionResponse> {
  return apiGet<SubscriptionResponse>("/payments/subscription");
}
