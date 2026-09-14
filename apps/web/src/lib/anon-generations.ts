// Anonymous generations have no userId server-side, so there's nothing to
// query by "this visitor's generations" once they sign up. Instead we track
// every generation id this browser saw while logged out, and claim them all
// in one call right after auth succeeds (see AuthForm) — otherwise a
// freshly-signed-up user's own redesign disappears from "My projects".
const STORAGE_KEY = "sundera:anon-generations";
const MAX_TRACKED = 50;

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberAnonGeneration(id: string): void {
  if (typeof window === "undefined") return;
  const ids = readIds();
  if (ids.includes(id)) return;
  const next = [...ids, id].slice(-MAX_TRACKED);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full/unavailable — claiming is a best-effort nicety
  }
}

export function getAnonGenerationIds(): string[] {
  return readIds();
}

export function clearAnonGenerationIds(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
