# Athenaeum — one image serving the API and the built client.

FROM node:22-alpine AS build
WORKDIR /app
# Dependencies first: this layer is cached unless the manifests change.
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY src ./src
COPY --from=build /app/dist ./dist

# MONGODB_URI is supplied at run time, never baked into the image.
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "server/index.js"]
