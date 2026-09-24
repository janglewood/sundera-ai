export const PURCHASE_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
