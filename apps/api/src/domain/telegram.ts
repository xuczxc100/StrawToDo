import type { TelegramTodoItem } from "@strawtodo/shared";
import { AppError } from "../errors.js";
import type { AuthContext } from "./issues.js";
import { createIssue, deleteIssue, getIssue, listComments, listIssues } from "./issues.js";
import {
  hasActiveRunForIssue,
  listActiveRuns,
  listRuns,
  startQueue,
  startRun,
} from "./runs.js";

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

  const runs: Array<Awaited<ReturnType<typeof startRun>>> = [];
  const started: string[] = [];
  const blocked: string[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i].run) continue;
    try {
      runs.push(await startRun(auth, created[i].identifier));
      started.push(created[i].identifier);
    } catch (err) {
      if (err instanceof AppError && err.status === 409) {
        blocked.push(created[i].identifier);
      } else {
        throw err;
      }
    }
  }

  let message = `已建立 ${created.map((i) => i.identifier).join("、")}`;
  if (started.length) {
    message = `${message}；已開始執行 ${started.join("、")}`;
  } else if (items.some((item) => item.run)) {
    message = `${message}；未能立刻派工，留在 Todo 佇列`;
  } else {
    message = `${message}，已放入 Todo 佇列`;
  }
  if (blocked.length) {
    message = `${message}（${blocked.join("、")} 該單已有進行中 Run）`;
  }

  return {
    items: created,
    runs,
    run: runs[0] || null,
    queued: runs.length === 0,
    busy: blocked.length > 0,
    message,
  };
}

export async function telegramQueue(auth: AuthContext) {
  const [todos, inProgress, inReview, active_runs] = await Promise.all([
    listIssues(auth, { status: "todo", limit: 50 }),
    listIssues(auth, { status: "in_progress", limit: 20 }),
    listIssues(auth, { status: "in_review", limit: 20 }),
    listActiveRuns(auth.teamId),
  ]);
  return {
    active_runs,
    active_run: active_runs[0] || null,
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

export async function telegramDelete(auth: AuthContext, id: string) {
  const issue = await getIssue(auth, id);
  if (await hasActiveRunForIssue(issue.id)) {
    throw new AppError("run_busy", `${issue.identifier} 進行中，不能刪除`, 409);
  }
  await deleteIssue(auth, issue.id);
  return { deleted: issue.identifier, message: `已刪除 ${issue.identifier}` };
}
