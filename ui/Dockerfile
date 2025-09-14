FROM node:20-alpine AS build
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
