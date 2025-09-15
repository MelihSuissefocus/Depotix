FROM node:20-alpine AS build
WORKDIR /app

# häufig benötigte Libs auf Alpine (z.B. sharp)
RUN apk add --no-cache libc6-compat python3 make g++

# Quellcode rein (der Build-Kontext ist bereits der UI-Ordner)
COPY . .

# npm/pnpm/yarn – ohne Lockfile: npm install mit legacy-peer-deps
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
RUN corepack enable && \
    if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install --legacy-peer-deps; fi

# Build mit Fallback
RUN npm run build || (yarn build || pnpm build)

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm","run","start"]
