# Domain Glossary

| 詞 | 定義 |
|----|------|
| Workspace | 頂層租戶容器；v0.1 預設單一 workspace。 |
| Team | 工作區內團隊；issue identifier 前綴來自 team key（預設 `STD`）。 |
| Project | 議題分組容器。 |
| Issue | 可追蹤工作項；含 status / priority / assignee / labels。 |
| Cycle | 時間盒規劃單位；**v0.2** 才實作。 |
| Comment | 議題留言；agent 進度回報主要通道。 |
| ApiKey | 給 agent／自動化的認證憑證（hash 儲存）。 |
| Outbox | transactional webhook 佇列，保證事件不因行程崩潰而遺失。 |

狀態列舉：`backlog` · `todo` · `in_progress` · `in_review` · `done` · `canceled`
