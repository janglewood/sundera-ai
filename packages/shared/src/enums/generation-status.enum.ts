export const GENERATION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export type GenerationStatus = (typeof GENERATION_STATUSES)[number];
