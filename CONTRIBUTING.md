# Contributing

感謝有興趣貢獻 StrawToDo。

## 開發

1. Node.js ≥ 20、Docker
2. `cp .env.example .env`（勿提交真實 secrets）
3. `docker compose up -d db && npm install && npm run db:migrate`
4. `npm run check` 必須通過後再送 PR

## 分支

唯一長期分支：`main`。

## Commit

建議 Conventional Commits：`feat:` / `fix:` / `docs:` / `test:`。

## 範圍

請先讀 [docs/non-goals.md](docs/non-goals.md)。v0.1 優先強化 API／MCP／可靠性，而非堆 UI。
