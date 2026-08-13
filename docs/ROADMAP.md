# Roadmap — from walking skeleton to full MVP

This tracks the gap between [docs/interior-ai-brief.md](interior-ai-brief.md) (the full product vision) and what's actually built today ([docs/SPEC.md](SPEC.md)). The walking skeleton covers the *core loop* — upload → select → generate → before/after — end-to-end and verified with a real key. Everything below was deliberately deferred, not forgotten; each item notes why, so a future agent can judge whether the original reasoning still holds before picking it up.

## Next up — brief §3 MVP checklist items not yet built

Roughly in the order they unblock each other:

1. **Auth (email, Apple Sign-In, Google Sign-In).** The schema is ready for this — `User.id`/`email` exist, `userId` is nullable on `RoomPhoto` and `Generation` so wiring up real accounts is additive, not a migration. Brief note: registration should happen *after* the user sees their first result, not before — the onboarding flow (`/` → `/new` → `/generations/[id]`) already works anonymously today, so the natural insertion point is a soft prompt after the first `COMPLETED` generation, not a gate in front of `/`.
2. **Generation history per account.** Once auth exists, `Generation.userId` just needs to be populated on create and a `GET /generations?userId=` (or `/me/generations`) list endpoint added. `GenerationResult` is already a separate table (not a JSON blob) specifically so this is additive.
3. **Free-tier limits + paywall UI** (brief §4 pricing table). Per the brief, **no real billing yet** — this is a UI + a server-side generation-count gate, not a Stripe/StoreKit integration (see "Explicitly deferred" below). Needs the anti-abuse note from brief §4: a hard per-account/device limit and some protection against re-registering for fresh free generations (device fingerprint or email-domain throttling to start).
4. **Save result to device** — client-side download of the selected result image, no backend change needed.
5. **Sharing** — native share sheet on mobile web / RN later; on web, a shareable link to a public(-ish) result view. Needs a decision on whether shared result pages require the presigned-URL dance to stay private, or whether shared generations get a longer-lived/public URL — currently every image URL is a 1hr presigned MinIO/S3 URL, which is wrong for a "share to TikTok/Pinterest" flow that brief §6 leans on for organic growth.
6. **Voice input** (speech-to-text for the free-text style refinement field in `/new`). Brief specifies this is client-side only (Web Speech API / RN Speech framework) — no backend service needed, isolated to `components/select/` + the free-text `<textarea>` already in `app/new/page.tsx`.
7. **Analytics funnel** (signup → first generation → paywall view → payment). Brief recommends PostHog/Amplitude/Mixpanel. Nothing is instrumented yet.

## Explicitly deferred (brief says so directly — don't build without re-confirming priority)

- **Real billing** (Stripe / StoreKit / Google Play Billing). Brief §3 backlog explicitly says: paywall UI yes, real payment no, for this phase.
- **Video redesign.** Brief §3: no solved per-frame style-consistency approach exists yet; treated as a separate, harder ML problem for a later phase.
- **React Native mobile app.** Brief §1: added after web traffic validates the core loop. Same backend/API either way — `apps/api` doesn't need to change to support this later, it's purely a new `apps/mobile` consuming the same endpoints.

## Technical debt / risks carried forward from the walking skeleton build

- **No systematic model comparison was done.** Brief §5 calls for comparing 3–5 OpenRouter models on price/speed/room-geometry-preservation before committing. The skeleton just defaults to `google/gemini-2.5-flash-image` (works well in manual testing, preserves structure convincingly) via the `OPENROUTER_MODEL` env var — swapping is cheap (see SPEC.md's provider boundary) but the actual comparison exercise hasn't happened.
- **No retry/backoff on generation failure.** A single OpenRouter error → `status=FAILED` → user has to start over manually. Fine for a skeleton; revisit once real users hit transient provider errors.
- **DB-polling worker, not a queue.** Deliberate for single-instance dev (see CLAUDE.md gotchas). If `apps/api` ever runs multiple replicas or needs backoff/priority queues, swap `GenerationWorkerService`'s claim loop for BullMQ/Redis — the `ImageGenerationProvider` interface and `GenerationsController` don't need to change either way.
- **Free-tier abuse protection doesn't exist yet** because there's no auth to abuse — becomes a real requirement the moment item 1 + item 3 above ship together.
- **Image URLs are always short-lived presigned URLs**, including the source photo and every result. This is fine for the current polling-based flow but actively wrong for the sharing feature (item 5) and for any future "public gallery" feature — needs a deliberate decision (public bucket ACL for shared results? long-lived signed URLs? a redirect endpoint?) rather than reusing `getPresignedGetUrl` as-is.

## Longer-term backlog (brief §7 — not MVP-blocking, revisit after the above)

- Landscape/outdoor design as a separate mode (different segmentation pipeline, different style catalog)
- Shoppable furniture with real SKU-level matching + affiliate monetization (brief notes furniture-brand affiliate terms are usually better than Amazon's)
- Video as an input format
- AR preview / 3D room scanning (RoomPlan/LiDAR)
- Multi-room projects / floor plans
- Live designer review of results
- Pro tooling: real-estate agency / design-studio accounts, API access
