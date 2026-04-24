# syntax=docker/dockerfile:1

# ── Stage 1: builder ──────────────────────────────────────────────────────────
# Installs all deps, compiles shared + API, generates Prisma client
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy manifests first — this layer is cached until a dependency changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source (node_modules excluded via .dockerignore)
COPY . .

# 1. Generate Prisma client for the target platform
RUN pnpm --filter @rezeta/db generate

# 2. Compile @rezeta/shared → packages/shared/dist/
RUN pnpm --filter @rezeta/shared build

# 3. Compile @rezeta/api → apps/api/dist/
RUN pnpm --filter @rezeta/api build


# ── Stage 2: runner ───────────────────────────────────────────────────────────
# Lean production image — only compiled JS + production deps + Prisma client
FROM node:24-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install production deps only — workspace packages are symlinked, filled below
# --frozen-lockfile is omitted here: only partial workspace manifests are present
# in this stage, which causes pnpm's lockfile validation to fail. Integrity was
# already verified in the builder stage.
RUN pnpm install --prod

# Compiled API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Prisma generated client (includes the query engine binary)
COPY --from=builder /app/packages/db/generated ./packages/db/generated

# Prisma schema — needed by the client to resolve model metadata at runtime
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Compiled shared package — pnpm symlinks node_modules/@rezeta/shared here
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
