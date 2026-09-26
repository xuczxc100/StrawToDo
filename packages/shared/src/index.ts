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

export const CreateIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(100_000).optional().default(""),
  status: IssueStatusSchema.optional().default("backlog"),
  priority: IssuePrioritySchema.optional().default("none"),
  project_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  label_ids: z.array(z.string().uuid()).optional().default([]),
});
export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

export const UpdateIssueSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(100_000).optional(),
    status: IssueStatusSchema.optional(),
    priority: IssuePrioritySchema.optional(),
    project_id: z.string().uuid().nullable().optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    label_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });
export type UpdateIssueInput = z.infer<typeof UpdateIssueSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(50_000),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

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
  Comment: "議題留言；agent 進度回報主要通道。",
  ApiKey: "給 agent／自動化的認證憑證。",
} as const;
