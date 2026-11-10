# Tamalou : un seul service qui sert le jeu (Socket.IO), l'API et l'appli mobile.

# --- Construction ------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY shared shared
COPY server server
COPY client client
COPY tsconfig.base.json ./
RUN npm run build -w client && npm run build -w server && npm prune --omit=dev

# --- Exécution ---------------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST=/app/client/dist \
    ASSETS_DIR=/app/data/assets \
    BOT_NAMES_FILE=/app/server/config/bot-names.json
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY server/config server/config
RUN mkdir -p /app/data/assets && chown -R node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server/dist/index.js"]
