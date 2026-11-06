FROM node:24-slim

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/content/package.json packages/content/
COPY packages/import/package.json packages/import/
COPY apps/api/package.json apps/api/

# Pas de `pnpm deploy` : il recopierait @portfolio-matis/content dans node_modules,
# où Node refuse d'exécuter du TypeScript. Le lien de l'espace de travail reste ainsi en place.
RUN pnpm install --frozen-lockfile --prod --filter "@portfolio-matis/api..."

COPY packages/content/src packages/content/src
COPY apps/api/src apps/api/src
COPY apps/api/drizzle apps/api/drizzle

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/data.db
ENV MEDIA_DIR=/data/media
ENV PORT=3000

# Le volume reprend ce propriétaire à sa création : la base et les médias restent modifiables.
RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "apps/api/src/server.ts"]
