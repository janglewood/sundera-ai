# Build context must be the repo root (pnpm workspace) — on Railway, set
# this service's Dockerfile path to apps/web/Dockerfile while leaving the
# root directory as the repo root.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
# NEXT_PUBLIC_* vars are baked in at build time, not read at runtime —
# Railway must have them set before/during this build, not just on the
# running container.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_BLOG_IMAGE_HOST
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
RUN pnpm --filter @sundera/shared build
RUN pnpm --filter @sundera/web build

# `output: "standalone"` (apps/web/next.config.ts) traces a minimal
# self-contained server — static assets and public/ aren't included in it
# and must be copied in separately.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
