# DigitalVetri PCRM — production image for Coolify (or any Docker host).
FROM node:20-slim AS base
WORKDIR /app
# OpenSSL is required by Prisma's query engine.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies (this layer is cached unless the lockfile changes).
COPY package.json package-lock.json ./
RUN npm ci

# Build the app. NEXT_PUBLIC_* env vars are inlined here, so they must be set
# in Coolify BEFORE the build. Pages are force-dynamic, so no DB is needed to build.
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# On start: sync the Prisma schema to the database (idempotent — this project uses
# `db push`, not migration files), then launch Next.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
