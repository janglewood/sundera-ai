export const SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
