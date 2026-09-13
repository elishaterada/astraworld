FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY apps/game-server ./apps/game-server
COPY packages ./packages
RUN npx esbuild apps/game-server/container.ts --bundle --platform=node --format=esm --packages=external --outfile=server.mjs
RUN npm prune --omit=dev

FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.mjs ./server.mjs
USER node
ENV GAME_HOST=0.0.0.0 GAME_PORT=8080 NODE_ENV=production
EXPOSE 8080 8081
CMD ["node", "server.mjs"]
