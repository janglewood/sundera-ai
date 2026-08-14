# Technical Spec — Walking Skeleton

Status: **implemented and verified end-to-end with a real OpenRouter key** (upload → generate → before/after result, in both curl and browser). This document describes what exists today, as a reference for extending it. For what's deliberately *not* built yet, see [ROADMAP.md](ROADMAP.md).

## Monorepo layout

```
sundera-ai/
├── apps/
│   ├── web/                Next.js App Router, TS, Tailwind — port 3000
│   └── api/                NestJS — port 4000
├── packages/
│   └── shared/              @sundera/shared — enums + DTO types used by both apps
├── docker-compose.yml       postgres + minio (+ minio-init bucket bootstrap)
└── .env.example
```

## Data model (`apps/api/prisma/schema.prisma`)

- **User** — `id, email? (unique), createdAt`. No auth fields yet.
- **RoomPhoto** — `id, userId? (nullable), storageKey, mimeType, width?, height?, createdAt`.
- **Generation** — `id, userId?, roomPhotoId, roomType (enum), style (enum), customPrompt?, status (PENDING|PROCESSING|COMPLETED|FAILED), model (string), errorMessage?, createdAt, startedAt?, completedAt?`. Indexed on `status`, `userId`.
- **GenerationResult** — `id, generationId, storageKey, index, createdAt`. One row per output variant; `@@unique([generationId, index])`.

`userId` is nullable throughout — anonymous usage today, additive when an auth module lands (no migration needed to attach a real user later). Enums (`RoomType`, `DesignStyle`, `GenerationStatus`) are mirrored as string-literal unions in `packages/shared/src/enums/`.

Prisma 7 requires a driver adapter — `apps/api/prisma.config.ts` + `PrismaService` (`apps/api/src/prisma/prisma.service.ts`) use `@prisma/adapter-pg`, not a bare `datasource.url`.

## API contract (`apps/api`)

Base URL: `http://localhost:4000` in dev. CORS restricted to `CORS_ORIGIN`. Global `ValidationPipe({ whitelist: true, transform: true })`.

### `GET /health`
→ `{ status: "ok" }`. Wired up as a boot/DB-connectivity smoke check (`app.controller.spec.ts`, `test/app.e2e-spec.ts`).

### `POST /uploads`
`multipart/form-data`, field name `photo`. JPEG/PNG/WebP only, ≤15MB (`UploadsController`, `apps/api/src/uploads/`).
- Stores the file in MinIO/S3 at `uploads/{uuid}.{ext}`, inserts a `RoomPhoto` row.
- → `{ id, previewUrl }` (`previewUrl` is a 1hr presigned GET URL).

### `POST /generations`
Body: `{ roomPhotoId, roomType, style, customPrompt? }` (validated against the shared enums via `CreateGenerationDto`, `class-validator`).
- Inserts a `Generation` row with `status=PENDING` and returns immediately — **does not call OpenRouter inline**.
- → `202 { id, status: "PENDING" }`.
- 404 if `roomPhotoId` doesn't exist.

### `GET /generations/:id`
Polling endpoint (`apps/api/src/generations/generations.controller.ts` + `generations.service.ts`).
- Re-presigns the source image and (if `COMPLETED`) each result image on every read — presigned URLs are never persisted, since they expire.
- → shape (matches `GenerationResponse` in `packages/shared/src/dto/generation.dto.ts`):
```json
{
  "id": "...",
  "status": "PENDING | PROCESSING | COMPLETED | FAILED",
  "roomType": "LIVING_ROOM",
  "style": "SCANDINAVIAN",
  "customPrompt": null,
  "sourceImageUrl": "https://.../uploads/....png?X-Amz-...",
  "resultImages": null,
  "errorMessage": null,
  "createdAt": "2026-08-13T...",
  "completedAt": null
}
```
  `resultImages` is `null` until `COMPLETED`, then `[{ index, url }, ...]` ordered by index (2–4 entries; currently always 3, see generation worker below).

## Backend module map (`apps/api/src`)

| Module | Responsibility |
|---|---|
| `prisma/` | `PrismaService` (global) — Prisma Client wired with the `pg` driver adapter, connect/disconnect lifecycle hooks |
| `storage/` | `StorageService` (global) — wraps `@aws-sdk/client-s3` + presigner. `putObject`, `getPresignedGetUrl`, `getObjectBuffer` (used to pull the source photo back out for the OpenRouter call), `buildObjectKey('uploads' \| 'results', id, ext, index?)` |
| `uploads/` | `POST /uploads` — validates mime type, stores object, creates `RoomPhoto` |
| `image-generation/` | Provider-agnostic boundary. `ImageGenerationProvider` interface (`editImage({ sourceImageDataUrl, prompt, variantCount }) → variants[]`) bound via DI token `IMAGE_GENERATION_PROVIDER` to `OpenRouterImageGenerationProvider`. **This is the swap point** — nothing outside this module knows the provider is OpenRouter/Gemini |
| `generations/` | Orchestrator: `GenerationsController` (create/poll), `GenerationsService` (CRUD + presigning on read), `GenerationWorkerService` (async processor, see below) |

### OpenRouter integration (`image-generation/openrouter-image-generation.provider.ts`)

`POST {OPENROUTER_BASE_URL}/images`, `Authorization: Bearer {OPENROUTER_API_KEY}`, model from `OPENROUTER_MODEL` (default `google/gemini-2.5-flash-image`).

**Known API constraint (discovered by testing against the real API, not documented upfront):** this model rejects `n > 1` when `input_references` is present (image-editing mode) — `"n: must be exactly 1"`. The provider works around this by firing `variantCount` parallel requests each with `n: 1` and flattening the results, rather than requesting `n: 3` in one call (`Promise.all` in `editImage()`). If you switch models via `OPENROUTER_MODEL`, re-check whether this still applies.

The source image is sent as a **base64 data URL** (`data:{mimeType};base64,...}`), not a presigned MinIO URL — OpenRouter's servers can't reach `localhost:9000` in dev, and this keeps dev/prod identical. 60s `AbortController` timeout per request.

Prompt shape (`generation-worker.service.ts` → `buildPrompt()`):
> "Redesign this {room type} in {style} style. Preserve the existing walls, windows, doors, and camera perspective exactly; only change furniture, decor, materials, and color palette. {customPrompt if provided}"

### Async job flow (`generation-worker.service.ts`)

DB-polling, not a message queue. `@Cron('*/2 * * * * *')` every 2s:
1. **Claim**: raw SQL `UPDATE "Generation" SET status='PROCESSING', "startedAt"=now() WHERE id = (SELECT id FROM "Generation" WHERE status='PENDING' ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING ...` — atomic, safe even if multiple API instances ran this concurrently (they won't double-process the same row).
2. Fetch the room photo bytes from storage, build the data URL + prompt, call the provider for 3 variants.
3. Upload each result to `results/{generationId}/{index}.{ext}`, insert `GenerationResult` rows.
4. Set `status=COMPLETED, completedAt=now()`, or on any thrown error, `status=FAILED, errorMessage=...`.

No retries/backoff — a failed generation stays `FAILED`, the user has to start over from the UI. This was a deliberate scope cut, not an oversight (see ROADMAP.md).

## Frontend (`apps/web/src`)

Client-driven flow, no Next.js API routes/proxy — the browser calls the Nest API directly via `NEXT_PUBLIC_API_BASE_URL` (CORS-enabled on the Nest side).

| Route | Component(s) | Behavior |
|---|---|---|
| `/` | `app/page.tsx` + `components/upload/PhotoDropzone.tsx` | Upload a photo → `POST /uploads` → routes to `/new?photoId=` |
| `/new` | `app/new/page.tsx` + `components/select/{RoomTypeGrid,StyleGrid}.tsx` | Pick room type + style (+ optional free-text) → `POST /generations` → routes to `/generations/{id}` |
| `/generations/[id]` | `app/generations/[id]/page.tsx` → `components/generation/GenerationView.tsx` | Polls via `lib/use-poll-generation.ts` (`usePollGeneration`, 2s interval, stops on terminal status) → renders `GenerationProgress` while pending/processing, `BeforeAfterSlider` + variant thumbnails once `COMPLETED`, an error state with a "Try again" link on `FAILED` |

`lib/api-client.ts` is the thin fetch wrapper (`apiGet`, `apiPostJson`, `apiPostForm`, throws `ApiError` with `.status`); `lib/generations.ts` has the three typed calls (`createUpload`, `createGeneration`, `getGeneration`) built on top of it, typed against `@sundera/shared`'s DTOs.

`BeforeAfterSlider` is hand-rolled (no external dependency) — draggable divider between the source photo and the selected result variant.

## Environment variables

See `.env.example` at repo root — copied into `apps/api/.env` and (`NEXT_PUBLIC_API_BASE_URL` only) `apps/web/.env.local`, both gitignored. `OPENROUTER_API_KEY` must be a real key; nothing in the app fabricates or mocks it.

## Local dev infra (`docker-compose.yml`)

- `postgres:16-alpine` — `sundera`/`sundera`/`sundera`, port 5432
- `minio/minio` — ports 9000 (API) / 9001 (console), `minioadmin`/`minioadmin`
- `minio-init` — one-shot `mc mb` to create the `sundera-media` bucket on first boot

## Verification performed

- `apps/api/src/app.controller.spec.ts`, `apps/api/test/app.e2e-spec.ts` — health check smoke tests.
- `apps/api/src/image-generation/openrouter-image-generation.provider.spec.ts` — asserts the OpenRouter request shape (mocked `fetch`), including the per-variant `n: 1` workaround.
- Manual curl-based end-to-end run with a real `OPENROUTER_API_KEY`: upload → create generation → poll to `COMPLETED`, confirmed the object landed in MinIO and the presigned URL served a real, valid PNG.
- Playwright-driven full browser click-through against the real API: upload → select Living Room / Boho → generate → before/after slider rendered 3 real result variants, thumbnail switching worked, zero console errors.

No broader automated test suite exists yet — deliberate for this stage of the build (see ROADMAP.md before investing in one; the highest-value next tests are probably around the generation worker's claim logic and DTO validation, not UI snapshot tests).
