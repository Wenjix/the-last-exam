FROM node:20

RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
RUN npm install -g node-gyp

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile

# Force compile better-sqlite3 native binding from source
RUN SQLITE_DIR=$(find /app/node_modules -name "binding.gyp" -path "*/better-sqlite3/*" -print -quit | xargs dirname) && \
    echo "Compiling better-sqlite3 in: $SQLITE_DIR" && \
    cd "$SQLITE_DIR" && \
    node-gyp rebuild --release && \
    ls -la build/Release/better_sqlite3.node

RUN pnpm build

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
