import { z } from "zod";

export const IssueStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
]);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssuePrioritySchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "urgent",
]);
export type IssuePriority = z.infer<typeof IssuePrioritySchema>;

export const IssueTypeSchema = z.enum(["feature", "bug", "chore"]);
export type IssueType = z.infer<typeof IssueTypeSchema>;

export const AssigneeTypeSchema = z.enum(["user", "agent"]);
export type AssigneeType = z.infer<typeof AssigneeTypeSchema>;

export const CreateIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(100_000).optional().default(""),
  status: IssueStatusSchema.optional().default("backlog"),
  priority: IssuePrioritySchema.optional().default("none"),
  issue_type: IssueTypeSchema.optional().default("feature"),
  assignee_type: AssigneeTypeSchema.optional().default("agent"),
  sort_order: z.number().int().optional(),
  project_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  label_ids: z.array(z.string().uuid()).optional().default([]),
  source: z.string().max(40).optional().default("web"),
  source_ref: z.string().max(200).optional().default(""),
});
export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

export const TelegramTodoItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(100_000).optional().default(""),
  priority: IssuePrioritySchema.optional().default("high"),
  issue_type: IssueTypeSchema.optional().default("feature"),
  run: z.boolean().optional().default(false),
  source_ref: z.string().max(200).optional().default(""),
});
export type TelegramTodoItem = z.infer<typeof TelegramTodoItemSchema>;

export const TelegramInboxSchema = z.union([
  TelegramTodoItemSchema,
  z.object({ items: z.array(TelegramTodoItemSchema).min(1).max(20) }),
]);
export type TelegramInboxInput = z.infer<typeof TelegramInboxSchema>;

export const UpdateIssueSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(100_000).optional(),
    status: IssueStatusSchema.optional(),
    priority: IssuePrioritySchema.optional(),
    issue_type: IssueTypeSchema.optional(),
    assignee_type: AssigneeTypeSchema.optional(),
    sort_order: z.number().int().optional(),
    project_id: z.string().uuid().nullable().optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    label_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });
export type UpdateIssueInput = z.infer<typeof UpdateIssueSchema>;

export const ReorderIssuesSchema = z.object({
  status: IssueStatusSchema,
  ids: z.array(z.string()).min(1),
});
export type ReorderIssuesInput = z.infer<typeof ReorderIssuesSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  key: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z][A-Z0-9]+$/)
    .optional(),
  cwd: z.string().max(1000).optional().default(""),
  default_prompt: z.string().max(20_000).optional().default(""),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(50_000),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const CreateRunSchema = z.object({
  model: z.string().min(1).max(80).optional(),
});
export type CreateRunInput = z.infer<typeof CreateRunSchema>;

export const RunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const WEBHOOK_EVENT_TYPES = [
  "issue.created",
  "issue.updated",
  "issue.status_changed",
  "comment.created",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** Domain glossary (E1) */
export const GLOSSARY = {
  Workspace: "頂層租戶容器；v0.1 預設單一 workspace。",
  Team: "工作區內的團隊；issue identifier 前綴來自 team key。",
  Project: "議題分組容器。",
  Issue: "可追蹤工作項；含 status / priority / assignee / labels。",
  Cycle: "時間盒規劃單位；v0.2 才實作。",
  Comment: "議題留言；人與 Agent 寫在同一條時間線。",
  Run: "一張 Issue 的一次 Agent 派工；對應 cursor-openai-bridge job。",
  TelegramInbox: "Telegram Cursor 專用入口：只建 Todo、執行、查狀態，不編輯。",
  ApiKey: "給 agent／自動化的認證憑證。",
} as const;
