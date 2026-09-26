FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
RUN npm install
COPY . .
RUN npm run build -w @strawtodo/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
