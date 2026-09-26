# MVP v0.1 驗收清單

## API

- [x] `/v1/health`
- [x] Projects CRUD（list/create）
- [x] Issues CRUD + list filters
- [x] Comments list/create
- [x] Search
- [x] API Key auth + create key
- [x] Idempotency-Key on create issue
- [x] OpenAPI at `/v1/openapi.json` + `/docs`

## MCP

- [x] list_issues / get_issue / create_issue / update_issue / add_comment / search

## Webhook

- [x] Outbox table + worker
- [x] HMAC signature docs

## Web UI

- [x] List + status/project filters
- [x] Create issue
- [x] Detail: status change + comments

## Ops

- [x] Docker Compose（db/api/web）
- [x] Apache-2.0 / README / CONTRIBUTING / SECURITY
- [x] Agent E2E test（create→update→comment→done）

## 發版 checklist

- [x] `npm run check` 全綠
- [x] `docker compose up --build` 後 60s 內 health OK
- [x] Playwright UI 煙霧通過
- [x] `npm run openapi:export` 產出 `docs/openapi.json`
- [ ] tag `v0.1.0`（使用者明示 push 後）
