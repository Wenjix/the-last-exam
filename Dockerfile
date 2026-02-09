FROM node:20

RUN corepack enable && corepack prepare pnpm@10.8.0 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm rebuild better-sqlite3
RUN pnpm build

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
