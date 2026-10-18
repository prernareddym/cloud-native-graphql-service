# ---- build stage: install all deps, compile TypeScript ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: production deps + compiled output only ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER 1000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["wget", "-qO-", "http://127.0.0.1:4000/healthz"]
CMD ["node", "dist/index.js"]
