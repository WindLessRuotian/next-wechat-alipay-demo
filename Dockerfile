# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Placeholder, mock-only values so `next build` can evaluate the layout; real values come from --env-file at run time.
RUN APP_URL=http://localhost:3000 SESSION_SECRET=build-only-placeholder-not-a-secret-000 \
    DATABASE_URL=file:/tmp/build.db PAYMENT_MODE=mock npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/next.config.ts ./
RUN mkdir -p /app/data /app/certs && chown -R node:node /app
USER node
EXPOSE 3000
# Point DATABASE_URL at file:/app/data/app.db and mount /app/data as a volume to persist orders.
CMD ["npx", "next", "start", "-p", "3000"]
