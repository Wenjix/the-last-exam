FROM node:20-slim AS build

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.8.0 --activate

WORKDIR /app

# Copy package manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json apps/server/
COPY apps/runner/package.json apps/runner/
COPY apps/web/package.json apps/web/
COPY packages/ai/package.json packages/ai/
COPY packages/audio/package.json packages/audio/
COPY packages/content/package.json packages/content/
COPY packages/contracts/package.json packages/contracts/
COPY packages/game-core/package.json packages/game-core/
COPY packages/testkit/package.json packages/testkit/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# --- Production stage ---
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@10.8.0 --activate

WORKDIR /app
COPY --from=build /app .

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
