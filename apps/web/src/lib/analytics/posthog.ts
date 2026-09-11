import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// Mirrors the isFirebaseConfigured guard in lib/firebase.ts — analytics is
// optional in dev, so track()/identify() calls should no-op instead of
// crashing when no key is set.
export const isPostHogConfigured = Boolean(POSTHOG_KEY);

let initialized = false;

export function initPostHog() {
  if (!isPostHogConfigured || initialized) return;
  initialized = true;
  posthog.init(POSTHOG_KEY as string, {
    api_host: POSTHOG_HOST,
    // Only intentional, named events below — no autocapture/pageview noise.
    autocapture: false,
    capture_pageview: false,
    person_profiles: "identified_only",
  });
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!isPostHogConfigured) return;
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isPostHogConfigured) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!isPostHogConfigured) return;
  posthog.reset();
}
