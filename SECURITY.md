# Security Policy

## 回報漏洞

請寄信至維護者（GitHub Security Advisory 或私人管道），**不要**在公開 issue 貼 exploit。

## 設計要點

- API Key 僅存 SHA-256 hash
- 寫入支援 `Idempotency-Key`
- Webhook 使用 HMAC-SHA256（`X-StrawToDo-Signature`）
- 勿將 `.env`、真實 key 提交進 git

## 支援版本

| Version | Supported |
|---------|-----------|
| 0.1.x   | yes       |
