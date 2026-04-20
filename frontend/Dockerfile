# VeriFlow frontend — multi-stage Next.js image.
# Stage 1 installs deps + builds; stage 2 is the runtime node_modules +
# build output served by `next start`.
#
# `NEXT_PUBLIC_*` values are inlined into the client bundle during
# `next build`, so they must be visible at build time — not just at
# runtime. Railway (and any other platform using `docker build
# --build-arg`) passes them in via ARGs; we promote each ARG to an ENV
# before the build step so Next's build picks them up.

FROM node:22-slim AS builder
WORKDIR /app

# Build-time configuration. Expected to be forwarded via --build-arg by
# the orchestrator (Railway does this automatically for variables set
# on the service when it invokes `docker build`).
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE}
ENV NODE_ENV=production

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
