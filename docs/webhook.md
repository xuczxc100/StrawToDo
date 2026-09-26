# Webhook

## 設定

```bash
WEBHOOK_URL=https://example.com/hooks/strawtodo
WEBHOOK_SECRET=your-shared-secret
```

API 行程每 2 秒掃描 `webhook_outbox`，對未送達事件 POST JSON。

## 簽章

- Header：`X-StrawToDo-Signature`
- 算法：`HMAC-SHA256(secret, raw_body)` hex
- Header：`X-StrawToDo-Event`（事件型別）

驗證（Node）：

```js
import { createHmac, timingSafeEqual } from "node:crypto";
function verify(rawBody, signature, secret) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

## 事件（v0.1）

- `issue.created`
- `issue.updated`
- `issue.status_changed`
- `comment.created`

## 重試

指數退避（2^attempts 秒，上限 3600），最多 8 次。請以事件 `id` 做冪等消費，防重放。
