import { apiPostJson } from "./api-client";

export function submitFeedback(email: string, message: string): Promise<{ ok: true }> {
  return apiPostJson("/feedback", { email, message });
}
