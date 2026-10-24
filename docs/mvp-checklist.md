# MVP 驗收清單

## v0.2.0.1 Agent 派工

- [x] Linear Board / List / Queue / Issue 詳情
- [x] Run API + 全域單 Run
- [x] 成功 → In Review + agent comment；失敗不進 Done
- [x] mock + Playwright（board create → run → in review；390px 無溢位）
- [x] `todo.wastebase.xyz` 公開
- [x] 版本 a.b.c.d + `scripts/bump-version.sh`

## v0.2.1.3 Telegram Inbox API

- [x] `POST /v1/telegram/todos` 建 Todo（可立刻 run）；busy 時留佇列
- [x] `GET /v1/telegram/queue`／`todos/:id` 唯讀
- [x] CLI `strawtodo`；MCP `inbox_*`
- [x] 沒有 Telegram 編輯端點

## v0.2.1.2 Vue 動畫

- [x] `router-view` 用 `<Transition name="page" mode="out-in">`
- [x] Board 卡片 `<TransitionGroup name="chip">`；List／Queue／留言 `name="row"`
- [x] Login appear + 錯誤 fade；`prefers-reduced-motion`
- [x] Playwright motion + 390px

## v0.1 API（仍有效）

- [x] `/v1/health`
- [x] Projects / Issues / Comments / Search
- [x] API Key + Idempotency-Key
- [x] OpenAPI + MCP + Webhook outbox
