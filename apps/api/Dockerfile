# Build context must be the repo root (pnpm workspace) — on Railway, set
# this service's Dockerfile path to apps/api/Dockerfile while leaving the
# root directory as the repo root.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Manifests only, so `pnpm install` is cached across builds as long as no
# dependency changes — pnpm needs every workspace member's package.json
# present (per pnpm-workspace.yaml globs) even ones this image doesn't run.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @sundera/shared build
# `prisma generate` only reads schema.prisma to emit client code — it never
# connects to a database — but prisma.config.ts's env("DATABASE_URL") makes
# the config loader require the var to resolve to *something*. Placeholder
# only; the real DATABASE_URL is supplied at runtime by Railway.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    pnpm --filter @sundera/api exec prisma generate
RUN pnpm --filter @sundera/api build

# Keeps full node_modules (incl. devDependencies) rather than a pruned
# install — `prisma` (the migrate CLI, run at container start) is a
# devDependency, and this app isn't large enough yet for image size to be
# worth the extra complexity of a pruned pnpm-deploy runtime stage.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 4000
# Calling the prisma binary directly (not `pnpm exec`) — pnpm exec runs a
# workspace dependency-consistency check first, which fails here since this
# stage deliberately omits the root manifests/apps/web that check expects.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
