# ---- Build stage: compile the Vite/React frontend ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage: Node API server that also serves the built SPA ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
EXPOSE 8787
# Run TypeScript directly with tsx (a prod dependency); no build/emit step for the server.
CMD ["npx", "tsx", "server/index.ts"]
