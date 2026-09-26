# StrawToDo

Agent-first 開源 Issue Tracker：給人用的薄 Web UI，給 AI agent 用的一等公民 **OpenAPI / MCP / Webhook**。

**授權：** Apache-2.0 · **版本：** 0.1.0 · **分支：** `main` only

## 一分鐘自架

```bash
cp .env.example .env
docker compose up -d --build
curl -s http://localhost:3040/v1/health
# Web UI: http://localhost:3041
# OpenAPI: http://localhost:3040/docs
```

預設 bootstrap API Key（可在 `.env` 改 `BOOTSTRAP_API_KEY`）：

```text
std_dev_bootstrap_key_change_me
```

在 Web UI 右上角貼上 API Key 後即可建立／更新議題。

## Agent（MCP）

```bash
export STRAWTODO_API_BASE=http://localhost:3040
export STRAWTODO_API_KEY=std_dev_bootstrap_key_change_me
npm run start -w @strawtodo/mcp
```

MCP tools：`list_issues`、`get_issue`、`create_issue`、`update_issue`、`add_comment`、`search`。

## 本機開發

```bash
# 先起 DB
docker compose up -d db
cp .env.example .env
npm install
export $(grep -v '^#' .env | xargs)
npm run db:migrate
npm run dev:api   # :3040
npm run dev:web   # :3041
```

## 測試

```bash
export DATABASE_URL=postgres://strawtodo:strawtodo@localhost:5433/strawtodo
export BOOTSTRAP_API_KEY=std_dev_bootstrap_key_change_me
npm run check
npx playwright test
```

## 倉庫結構

```text
apps/api     Hono + Postgres REST API
apps/web     Vue 3 薄 UI
apps/mcp     MCP stdio server
packages/shared  Zod schemas + glossary
docs/        OpenAPI 匯出、webhook、MVP checklist
```

## 非目標（v0.1）

完整 Linear 級看板客製、複雜權限／SSO、行動 App、一鍵 Linear 匯入、即時多人游標。詳見 [docs/non-goals.md](docs/non-goals.md)。

## 安全

見 [SECURITY.md](SECURITY.md)。Webhook 簽章見 [docs/webhook.md](docs/webhook.md)。
