FROM docker.m.daocloud.io/library/node:22-alpine

ARG APP_VERSION=6.0

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY docker-entrypoint.sh ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV APP_VERSION=${APP_VERSION}
ENV PORT=8080
ENV PUBLIC_PORT=8080
ENV PUBLIC_BASE_URL=
ENV DATA_DIR=/app/data
ENV OPENCLAW_STATE_DIR=/app/data/openclaw
ENV LEGACY_DATA_DIR=/app/legacy-data

RUN chmod +x /app/docker-entrypoint.sh

LABEL org.opencontainers.image.title="wechat-clawbot-gateway"
LABEL org.opencontainers.image.version="${APP_VERSION}"

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
