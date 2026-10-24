# StrawToDo

Linear 式任務板：你安排 Issue，每一張由 Cursor Agent 獨立跑完並寫回回應。做完自動進 **In Review**，Agent 不能自己標 Done。

**版本：** 0.2.0.1 · **分支：** `main` only · **授權：** Apache-2.0

公開站：`https://todo.wastebase.xyz`

## 核心迴圈

安排 Issue → Todo 佇列 → 執行 Agent → In Progress → 寫回 comment → In Review → 你標 Done 或 Restart。

全站同時只跑 **一個** Run，避免兩張任務搶同一工作區。

## 本機

```bash
cp .env.example .env
docker compose up -d db
npm install
export $(grep -v '^#' .env | xargs)
npm run db:migrate
npm run dev:api   # :3040，AGENT_MODE=mock 不打真 Agent
npm run dev:web   # :3041
```

Web 右上角 API Key 預設 `std_dev_bootstrap_key_change_me`（`EXPOSE_UI_KEY=1` 時會自動填）。

## 測試

```bash
export DATABASE_URL=postgres://strawtodo:strawtodo@localhost:5433/strawtodo
export BOOTSTRAP_API_KEY=std_dev_bootstrap_key_change_me
npm run check
npx playwright test
```

## 自架（接真實 Cursor Agent）

API 使用 `network_mode: host`，才能打本機 `cursor-openai-bridge`（`127.0.0.1:8643`）。

```bash
# deploy/.env（勿進 git）
BOOTSTRAP_API_KEY=...
BRIDGE_API_KEY=...
AGENT_MODE=bridge
EXPOSE_UI_KEY=1
docker compose up -d --build
curl -s http://127.0.0.1:3040/v1/health
# UI: http://127.0.0.1:3041
```

## 倉庫

```text
apps/api     Hono + Postgres
apps/web     Vue 3 Board / List / Queue / Issue
apps/mcp     MCP stdio（讀寫 Issue）
packages/shared  Zod
```
