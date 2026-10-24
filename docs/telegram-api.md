# Telegram Inbox API

StrawToDo 主用途＝Telegram Cursor 對接使用者：**建 Todo、執行、查狀態**。不要進 Board 改欄位。

認證：`Authorization: Bearer <API_KEY>`（本機 `BOOTSTRAP_API_KEY`）。  
Base：`http://127.0.0.1:3040` 或 `https://todo.wastebase.xyz`。

## 建單（可立刻跑）

```http
POST /v1/telegram/todos
```

```json
{ "title": "修 nginx", "description": "使用者原話", "run": true, "source_ref": "tg:8857248716" }
```

一次多張：

```json
{ "items": [ { "title": "第一件", "run": true }, { "title": "第二件" } ] }
```

回傳 `items`、`run`（有派工才有）、`queued`、`busy`、`message`。已有 Run 時新單仍會建好，留在 Todo。

## 查 / 跑

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/v1/telegram/queue` | 佇列＋現行 Run |
| GET | `/v1/telegram/todos/:id` | 單張＋留言＋Run（唯讀） |
| POST | `/v1/telegram/todos/:id/run` | 執行指定單 |
| POST | `/v1/telegram/queue/start` | 執行下一張 |

這個命名空間**沒有 PATCH / 編輯**。

## CLI

```bash
~/.cursor/scripts/strawtodo add "修 nginx" -d "使用者原話" --run
~/.cursor/scripts/strawtodo queue
~/.cursor/scripts/strawtodo show STD-12
~/.cursor/scripts/strawtodo run STD-12
```
