import type { TelegramTodoItem } from "@strawtodo/shared";
import { AppError } from "../errors.js";
import type { AuthContext } from "./issues.js";
import { createIssue, getIssue, listComments, listIssues } from "./issues.js";
import { getRun, hasActiveRun, listRuns, startQueue, startRun } from "./runs.js";

export function normalizeInboxItems(
  raw: TelegramTodoItem | { items: TelegramTodoItem[] },
): TelegramTodoItem[] {
  if ("items" in raw && Array.isArray(raw.items)) return raw.items;
  return [raw as TelegramTodoItem];
}

export async function ingestTelegramTodos(
  auth: AuthContext,
  items: TelegramTodoItem[],
) {
  const created = [];
  for (const item of items) {
    created.push(
      await createIssue(auth, {
        title: item.title,
        description: item.description ?? "",
        status: "todo",
        priority: item.priority ?? "high",
        issue_type: item.issue_type ?? "feature",
        assignee_type: "agent",
        label_ids: [],
        source: "telegram",
        source_ref: item.source_ref ?? "",
      }),
    );
  }

  let run: Awaited<ReturnType<typeof startRun>> | null = null;
  let queued = true;
  let busy = false;
  let message = `已建立 ${created.map((i) => i.identifier).join("、")}`;
  const runAt = items.findIndex((item) => item.run);
  if (runAt >= 0) {
    try {
      run = await startRun(auth, created[runAt].identifier);
      queued = false;
      message = `${message}；已開始執行 ${created[runAt].identifier}`;
    } catch (err) {
      if (err instanceof AppError && err.status === 409) {
        busy = true;
        message = `${message}；目前有 Run 在跑，${created[runAt].identifier} 留在 Todo 佇列`;
      } else {
        throw err;
      }
    }
  } else {
    message = `${message}，已放入 Todo 佇列`;
  }

  return { items: created, run, queued, busy, message };
}

export async function telegramQueue(auth: AuthContext) {
  const [todos, inProgress, inReview] = await Promise.all([
    listIssues(auth, { status: "todo", limit: 50 }),
    listIssues(auth, { status: "in_progress", limit: 20 }),
    listIssues(auth, { status: "in_review", limit: 20 }),
  ]);
  let active_run: Awaited<ReturnType<typeof getRun>> | null = null;
  if (await hasActiveRun()) {
    const runningIssue = inProgress[0];
    if (runningIssue) {
      const runs = await listRuns(auth, runningIssue.identifier);
      const live = runs.find((r) => r.status === "running" || r.status === "queued");
      active_run = live || null;
    }
  }
  return {
    active_run,
    todos,
    in_progress: inProgress,
    in_review: inReview,
  };
}

export async function telegramShow(auth: AuthContext, id: string) {
  const issue = await getIssue(auth, id);
  const comments = await listComments(auth, id);
  const runs = await listRuns(auth, id);
  return { issue, comments, runs, latest_run: runs[0] || null };
}

export async function telegramRun(auth: AuthContext, id: string, model?: string) {
  const run = await startRun(auth, id, model);
  return { run, message: `已開始執行 ${id}` };
}

export async function telegramStartNext(auth: AuthContext) {
  const run = await startQueue(auth);
  return { run, message: "已開始執行佇列下一張" };
}
