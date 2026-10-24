# MVP 驗收清單

## v0.2.0.1 Agent 派工

- [x] Linear Board / List / Queue / Issue 詳情
- [x] Run API + 全域單 Run
- [x] 成功 → In Review + agent comment；失敗不進 Done
- [x] mock + Playwright（board create → run → in review；390px 無溢位）
- [x] `todo.wastebase.xyz` 公開
- [x] 版本 a.b.c.d + `scripts/bump-version.sh`

## v0.1 API（仍有效）

- [x] `/v1/health`
- [x] Projects / Issues / Comments / Search
- [x] API Key + Idempotency-Key
- [x] OpenAPI + MCP + Webhook outbox
