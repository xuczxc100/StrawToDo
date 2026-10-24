import type { AuthContext } from "./issues.js";
import { addAgentComment, getIssue, listComments, updateIssue } from "./issues.js";
import { AppError } from "../errors.js";
import { getPool, withTransaction } from "../db/pool.js";
import { getJobClient } from "../agent/client.js";

export type RunRow = {
  id: string;
  issue_id: string;
  job_id: string | null;
  status: string;
  model: string;
  log_text: string;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
};

function mapRun(row: RunRow) {
  return {
    id: row.id,
    issue_id: row.issue_id,
    job_id: row.job_id,
    status: row.status,
    model: row.model,
    log_text: row.log_text,
    started_at: row.started_at?.toISOString() ?? null,
    ended_at: row.ended_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

export async function hasActiveRun(): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM runs WHERE status IN ('queued', 'running') LIMIT 1`,
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listRuns(auth: AuthContext, idOrIdentifier: string) {
  const issue = await getIssue(auth, idOrIdentifier);
  const r = await getPool().query<RunRow>(
    `SELECT * FROM runs WHERE issue_id = $1 ORDER BY created_at DESC`,
    [issue.id],
  );
  return r.rows.map(mapRun);
}

export async function getRun(auth: AuthContext, runId: string) {
  const r = await getPool().query<RunRow>(
    `SELECT r.* FROM runs r
     JOIN issues i ON i.id = r.issue_id
     WHERE r.id = $1 AND i.team_id = $2`,
    [runId, auth.teamId],
  );
  if (!r.rows[0]) throw new AppError("not_found", `Run not found: ${runId}`, 404);
  return mapRun(r.rows[0]);
}

function buildPrompt(issue: {
  identifier: string;
  title: string;
  description: string;
  issue_type?: string;
  status: string;
}, comments: Array<{ author_type?: string; body: string }>, cwd: string, extra: string) {
  const history = comments
    .map((c) => `- [${c.author_type === "agent" ? "Agent" : "使用者"}] ${c.body}`)
    .join("\n");
  return [
    "你正在 StrawToDo 執行單一 Issue。只做這張任務，做完停。",
    "",
    `識別碼：${issue.identifier}`,
    `標題：${issue.title}`,
    `類型：${issue.issue_type || "feature"}`,
    `目前狀態：${issue.status}`,
    cwd ? `工作目錄（cwd）：${cwd}` : "工作目錄：沿用 Cursor Agent 預設工作區。",
    "",
    "說明：",
    issue.description || "（無）",
    "",
    "先前留言：",
    history || "（無）",
    extra ? `\n專案附加指示：\n${extra}` : "",
    "",
    "規則：",
    "1. 做完必須寫測試結果（做了什麼、怎麼驗、結果）。",
    "2. 不要把這張 Issue 標成 Done。系統會改成 In Review。",
    "3. 失敗就停，說明原因，不要假裝完成。",
  ].join("\n");
}

export async function startRun(
  auth: AuthContext,
  idOrIdentifier: string,
  model?: string,
) {
  if (await hasActiveRun()) {
    throw new AppError(
      "run_busy",
      "已有一張 Issue 的 Agent 正在跑。等它結束或取消後再派下一張。",
      409,
    );
  }
  const issue = await getIssue(auth, idOrIdentifier);
  if (!["todo", "in_review", "backlog"].includes(issue.status)) {
    throw new AppError(
      "invalid_status",
      `只有 Backlog／Todo／In Review 可以派工，目前是 ${issue.status}`,
      409,
    );
  }

  const comments = await listComments(auth, issue.id);
  const project = issue.project_id
    ? await getPool().query<{ cwd: string; default_prompt: string }>(
        `SELECT cwd, default_prompt FROM projects WHERE id = $1`,
        [issue.project_id],
      )
    : { rows: [] as Array<{ cwd: string; default_prompt: string }> };
  const cwd = project.rows[0]?.cwd || "";
  const extra = project.rows[0]?.default_prompt || "";
  const prompt = buildPrompt(issue, comments, cwd, extra);
  const chosenModel = model || process.env.AGENT_MODEL || "auto";

  const run = await withTransaction(async (client) => {
    await client.query(
      `UPDATE issues SET status = 'in_progress', assignee_type = 'agent', updated_at = now()
       WHERE id = $1`,
      [issue.id],
    );
    const ins = await client.query<RunRow>(
      `INSERT INTO runs (issue_id, status, model, started_at)
       VALUES ($1, 'running', $2, now())
       RETURNING *`,
      [issue.id, chosenModel],
    );
    return ins.rows[0];
  });

  try {
    const job = await getJobClient().createJob(prompt, chosenModel, `std:${issue.identifier}`);
    const upd = await getPool().query<RunRow>(
      `UPDATE runs SET job_id = $2, log_text = $3 WHERE id = $1 RETURNING *`,
      [run.id, job.job_id, "已派工，等待 Agent…"],
    );
    return mapRun(upd.rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await getPool().query(
      `UPDATE runs SET status = 'failed', ended_at = now(), log_text = $2 WHERE id = $1`,
      [run.id, message],
    );
    await addAgentComment(auth, issue.id, `Agent 派工失敗：${message}`, run.id);
    await updateIssue(auth, issue.id, { status: "todo" });
    throw new AppError("bridge_error", `無法派工：${message}`, 502);
  }
}

export async function cancelRun(auth: AuthContext, runId: string) {
  const run = await getRun(auth, runId);
  if (!["queued", "running"].includes(run.status)) {
    throw new AppError("invalid_status", "只有進行中的 Run 可以取消", 409);
  }
  const upd = await getPool().query<RunRow>(
    `UPDATE runs SET status = 'canceled', ended_at = now(), log_text = $2 WHERE id = $1 RETURNING *`,
    [run.id, `${run.log_text}\n已取消。`.trim()],
  );
  return mapRun(upd.rows[0]);
}

export async function startQueue(auth: AuthContext) {
  if (await hasActiveRun()) {
    throw new AppError("run_busy", "佇列已有進行中的 Run", 409);
  }
  const next = await getPool().query<{ identifier: string }>(
    `SELECT identifier FROM issues
     WHERE team_id = $1 AND status = 'todo'
     ORDER BY sort_order ASC, created_at ASC
     LIMIT 1`,
    [auth.teamId],
  );
  if (!next.rows[0]) {
    throw new AppError("queue_empty", "Todo 佇列是空的", 404);
  }
  return startRun(auth, next.rows[0].identifier);
}

export async function tickRuns(): Promise<number> {
  const r = await getPool().query<RunRow>(
    `SELECT * FROM runs WHERE status = 'running' AND job_id IS NOT NULL`,
  );
  let settled = 0;
  for (const row of r.rows) {
    try {
      const job = await getJobClient().getJob(row.job_id as string);
      if (job.running) {
        const live = await getJobClient().readResult(row.job_id as string);
        if (live && live !== row.log_text) {
          await getPool().query(`UPDATE runs SET log_text = $2 WHERE id = $1`, [row.id, live]);
        }
        continue;
      }
      const result =
        (await getJobClient().readResult(row.job_id as string)) ||
        (job.exit === 0 ? "Agent 已結束，沒有文字結果。" : `Agent 異常結束（exit ${job.exit}）。`);
      const ok = job.exit === 0 || job.exit === null;
      await finalizeRun(row, ok ? "succeeded" : "failed", result);
      settled += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await finalizeRun(row, "failed", `輪詢失敗：${message}`);
      settled += 1;
    }
  }
  return settled;
}

async function finalizeRun(row: RunRow, status: "succeeded" | "failed", body: string) {
  const latest = await getPool().query<{ status: string }>(
    `SELECT status FROM runs WHERE id = $1`,
    [row.id],
  );
  if (latest.rows[0]?.status !== "running") return;

  await getPool().query(
    `UPDATE runs SET status = $2, ended_at = now(), log_text = $3 WHERE id = $1`,
    [row.id, status, body],
  );

  const issue = await getPool().query<{ id: string; team_id: string }>(
    `SELECT id, team_id FROM issues WHERE id = $1`,
    [row.issue_id],
  );
  if (!issue.rows[0]) return;
  const auth: AuthContext = {
    apiKeyId: "system",
    workspaceId: "",
    teamId: issue.rows[0].team_id,
    createdBy: "agent",
  };
  await addAgentComment(
    auth,
    issue.rows[0].id,
    status === "succeeded" ? body : `Agent 失敗：\n${body}`,
    row.id,
  );
  if (status === "succeeded") {
    await updateIssue(auth, issue.rows[0].id, { status: "in_review" }, { actor: "agent" });
  }
}

export function startRunWorker(intervalMs = 1500) {
  const timer = setInterval(() => {
    tickRuns().catch((err) => console.error("[strawtodo] tickRuns", err));
  }, intervalMs);
  timer.unref?.();
  return timer;
}
