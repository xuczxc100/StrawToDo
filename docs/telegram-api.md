# Telegram Inbox API

StrawToDo 主用途＝Telegram Cursor 對接使用者：**建 Todo、執行、查狀態、刪除**。不要進 Board 改欄位。

認證：`Authorization: Bearer <API_KEY>`（本機 `BOOTSTRAP_API_KEY`）。  
Base：`http://127.0.0.1:3040` 或 `https://todo.wastebase.xyz`。

## 建單（可立刻跑，可同時多張）

```http
POST /v1/telegram/todos
```

```json
{ "title": "修 nginx", "description": "使用者原話", "run": true, "source_ref": "tg:8857248716" }
```

一次多張：每個 `run:true` 都會派工（與聊天 job 並行）。

```json
{ "items": [ { "title": "第一件", "run": true }, { "title": "第二件", "run": true } ] }
```

回傳 `items`、`runs`、`run`（第一個）、`queued`、`busy`、`message`。同一張 Issue 已有進行中 Run 才會擋。

## 查 / 跑 / 刪

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/v1/telegram/queue` | 佇列＋`active_runs` |
| GET | `/v1/telegram/todos/:id` | 單張＋留言＋Run（唯讀） |
| POST | `/v1/telegram/todos/:id/run` | 執行指定單 |
| POST | `/v1/telegram/queue/start` | 執行下一張（不因其他 Run 拒絕） |
| DELETE | `/v1/telegram/todos/:id` | 刪除（進行中 409） |

這個命名空間**沒有 PATCH／編輯欄位**。

`source=telegram` 的 Run 結束後會推一則 Telegram（需 `TELEGRAM_BOT_TOKEN`＋`TELEGRAM_NOTIFY_CHAT_ID`）。失敗／取消回到 Todo。

## CLI

```bash
~/.cursor/scripts/strawtodo add "修 nginx" -d "使用者原話" --run
~/.cursor/scripts/strawtodo queue
~/.cursor/scripts/strawtodo show STD-12
~/.cursor/scripts/strawtodo run STD-12
~/.cursor/scripts/strawtodo rm STD-12
```
