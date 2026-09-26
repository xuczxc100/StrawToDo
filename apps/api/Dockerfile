FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
RUN npm install
COPY . .
RUN npm run build -w @strawtodo/shared && npm run build -w @strawtodo/api

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3040
CMD ["node", "apps/api/dist/index.js"]
