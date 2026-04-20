# VeriFlow frontend — multi-stage Next.js image.
# Stage 1 installs deps + builds; stage 2 is the runtime node_modules +
# build output served by `next start`.

FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN useradd --system --uid 1001 veriflow \
    && mkdir -p /app \
    && chown -R veriflow:veriflow /app

USER veriflow

COPY --chown=veriflow:veriflow --from=builder /app/node_modules ./node_modules
COPY --chown=veriflow:veriflow --from=builder /app/.next ./.next
COPY --chown=veriflow:veriflow --from=builder /app/public ./public
COPY --chown=veriflow:veriflow --from=builder /app/package.json ./package.json
COPY --chown=veriflow:veriflow --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
