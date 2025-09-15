FROM node:20-alpine AS build
WORKDIR /app

# Copy files
COPY package.json ./
COPY . .

# Install dependencies
RUN npm install --legacy-peer-deps

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build the application
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Copy standalone server
COPY --from=build /app/.next/standalone ./
# Copy static files
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]