# Sundera AI

AI interior redesign app: upload a photo of a room, pick a room type + design style, get back a photorealistic redesign that preserves the room's structure (walls, windows, perspective) via image-editing AI. Full product vision: [docs/interior-ai-brief.md](docs/interior-ai-brief.md) (original brief, in Russian). What's actually built vs. deferred: [docs/ROADMAP.md](docs/ROADMAP.md). Technical spec (data model, API contract, module map): [docs/SPEC.md](docs/SPEC.md).

**Current state:** a working walking skeleton — upload → room type/style select → async OpenRouter-driven generation → before/after result. No auth, no billing, no history persistence across sessions yet (see ROADMAP.md for what's next and why those were deferred).

## Stack

- **apps/web** — Next.js (App Router, TypeScript, Tailwind), mobile-first, port 3000
- **apps/api** — NestJS, port 4000
- **packages/shared** — `@sundera/shared`, TS enums + DTO types shared by both apps (compiled to `dist/`, both apps depend on it via `workspace:*`)
- **Postgres** via **Prisma 7** (driver-adapter based — see gotcha below)
- **MinIO** (S3-compatible) for object storage in dev, real S3/R2 in prod
- **OpenRouter** Unified Image API for generation, isolated behind an `ImageGenerationProvider` interface (`apps/api/src/image-generation/`) so the underlying model/provider is swappable
- pnpm workspaces + Turborepo

## Running it

```bash
docker compose up -d                                  # postgres + minio
pnpm install
pnpm --filter @sundera/api prisma migrate dev          # first time / after schema changes
pnpm dev                                                # turbo: web :3000, api :4000
```

Env vars live in `apps/api/.env` and `apps/web/.env.local` (gitignored), shape documented in `.env.example` at repo root. **`OPENROUTER_API_KEY` must be a real key** — nothing fakes this, generation will fail without one.

MinIO console: `http://localhost:9001` (`minioadmin`/`minioadmin`), bucket `sundera-media`.

## Gotchas worth knowing before touching this code

- **Prisma 7 requires a driver adapter.** `schema.prisma` has no `datasource.url` — connection config lives in `apps/api/prisma.config.ts` (CLI) and `apps/api/src/prisma/prisma.service.ts` instantiates `PrismaClient` with `@prisma/adapter-pg` explicitly. Don't add `url = env("DATABASE_URL")` back into the schema, it'll fail validation.
- **OpenRouter's `google/gemini-2.5-flash-image` rejects `n > 1` when `input_references` is set** (image-editing mode) — "n: must be exactly 1". `OpenRouterImageGenerationProvider.editImage()` works around this by firing one request per desired variant in parallel and flattening the results, rather than requesting `n: 3` in a single call. If you swap models via `OPENROUTER_MODEL`, re-verify whether this constraint still applies.
- **The source room photo is sent to OpenRouter as a base64 data URL, not a presigned MinIO URL.** OpenRouter's servers can't reach `localhost:9000` in local dev, and base64 keeps the dev/prod code path identical. See `GenerationWorkerService.process()`.
- **`apps/api/tsconfig.build.tsbuildinfo` can go stale and cause silent no-op builds** (`nest build`/`tsc` exits 0 but writes nothing to `dist/`) if `rootDir`/`exclude` change. If a build produces an empty `dist/`, delete the `.tsbuildinfo` file and rebuild.
- **The generation worker is a DB-polling cron (`@nestjs/schedule`, every 2s), not BullMQ/Redis.** It claims work via a raw-SQL `UPDATE ... WHERE status='PENDING' ... RETURNING *` with `FOR UPDATE SKIP LOCKED` — deliberate, not accidental; keeps this simple for single-instance dev. If you introduce retries/backoff/multi-instance scaling, that's the piece to replace; the `ImageGenerationProvider` interface boundary isn't affected either way.
- **`apps/web/CLAUDE.md` and `apps/web/AGENTS.md` are auto-managed by `next dev`** (Next 16 writes these). Don't hand-edit `AGENTS.md`; it gets regenerated.

## Conventions

- No formal test suite yet beyond two smoke tests (`apps/api/src/app.controller.spec.ts`, `apps/api/src/image-generation/openrouter-image-generation.provider.spec.ts`) — deliberate for this stage, see docs/SPEC.md verification section before deciding whether to expand.
- Prisma enums (`RoomType`, `DesignStyle`, `GenerationStatus`) are mirrored as string-literal union types + const arrays in `packages/shared/src/enums/` — keep both in sync if you add a room type or style.
- `userId` is nullable everywhere in the schema (anonymous usage today) — that's intentional forward-compatibility for the auth module described in ROADMAP.md, not an oversight.
