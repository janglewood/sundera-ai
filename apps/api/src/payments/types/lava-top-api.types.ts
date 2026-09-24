export type LavaTopCurrency = "RUB" | "USD" | "EUR";

export type LavaTopPeriodicity =
  | "ONE_TIME"
  | "MONTHLY"
  | "PERIOD_90_DAYS"
  | "PERIOD_180_DAYS"
  | "PERIOD_YEAR";

export type LavaTopContractStatus =
  | "new"
  | "in-progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "subscription-active"
  | "subscription-expired"
  | "subscription-cancelled"
  | "subscription-failed";

export type LavaTopWebhookEventType = "payment.success" | "payment.failed";

export interface CreateInvoiceV3Request {
  email: string;
  offerId: string;
  currency: LavaTopCurrency;
  periodicity?: LavaTopPeriodicity;
}

export interface InvoicePaymentParamsResponse {
  id: string;
  status: LavaTopContractStatus;
  amountTotal: { currency: LavaTopCurrency; amount: number };
  // null when the offer is free — we never hit that path since checkout is
  // only ever created for the paid LIFETIME tier.
  paymentUrl: string | null;
}

export interface LavaTopWebhookPayload {
  eventType: LavaTopWebhookEventType;
  product: { id: string; title: string };
  contractId: string;
  buyer: { email: string };
  amount: number;
  currency: LavaTopCurrency;
  status: LavaTopContractStatus;
  timestamp: string;
  errorMessage?: string | null;
}
