import type pg from "pg";
import type {
  CreateCommentInput,
  CreateIssueInput,
  CreateProjectInput,
  IssuePriority,
  IssueStatus,
  UpdateIssueInput,
  WebhookEventType,
} from "@strawtodo/shared";
import { AppError } from "../errors.js";
import { withTransaction, getPool } from "../db/pool.js";

export type AuthContext = {
  apiKeyId: string;
  workspaceId: string;
  teamId: string;
  createdBy: string;
};

export type IssueRow = {
  id: string;
  team_id: string;
  project_id: string | null;
  number: number;
  identifier: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_id: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  label_ids?: string[];
};

function mapIssue(row: IssueRow & { label_ids?: string[] | null }) {
  return {
    id: row.id,
    team_id: row.team_id,
    project_id: row.project_id,
    number: row.number,
    identifier: row.identifier,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee_id: row.assignee_id,
    label_ids: row.label_ids ?? [],
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function enqueue(
  client: pg.PoolClient,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
) {
  const payload = {
    id: undefined as string | undefined,
    type: eventType,
    created_at: new Date().toISOString(),
    data,
  };
  const res = await client.query<{ id: string }>(
    `INSERT INTO webhook_outbox (event_type, payload)
     VALUES ($1, $2::jsonb)
     RETURNING id`,
    [eventType, JSON.stringify(payload)],
  );
  const id = res.rows[0].id;
  payload.id = `evt_${id.replace(/-/g, "").slice(0, 26)}`;
  await client.query(`UPDATE webhook_outbox SET payload = $2::jsonb WHERE id = $1`, [
    id,
    JSON.stringify(payload),
  ]);
}

async function setLabels(
  client: pg.PoolClient,
  issueId: string,
  labelIds: string[],
) {
  await client.query(`DELETE FROM issue_labels WHERE issue_id = $1`, [issueId]);
  for (const lid of labelIds) {
    await client.query(
      `INSERT INTO issue_labels (issue_id, label_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [issueId, lid],
    );
  }
}

async function loadLabels(
  client: pg.PoolClient,
  issueId: string,
): Promise<string[]> {
  const r = await client.query<{ label_id: string }>(
    `SELECT label_id FROM issue_labels WHERE issue_id = $1`,
    [issueId],
  );
  return r.rows.map((x) => x.label_id);
}

export async function listProjects(auth: AuthContext) {
  const r = await getPool().query(
    `SELECT id, team_id, name, description, created_at, updated_at
     FROM projects WHERE team_id = $1 ORDER BY created_at DESC`,
    [auth.teamId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    team_id: row.team_id,
    name: row.name,
    description: row.description,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }));
}

export async function createProject(
  auth: AuthContext,
  input: CreateProjectInput,
) {
  const r = await getPool().query(
    `INSERT INTO projects (team_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, team_id, name, description, created_at, updated_at`,
    [auth.teamId, input.name, input.description ?? ""],
  );
  const row = r.rows[0];
  return {
    id: row.id,
    team_id: row.team_id,
    name: row.name,
    description: row.description,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listIssues(
  auth: AuthContext,
  filters: {
    status?: string;
    project_id?: string;
    q?: string;
    limit?: number;
  },
) {
  const limit = Math.min(filters.limit ?? 50, 100);
  const params: unknown[] = [auth.teamId];
  const where = ["i.team_id = $1"];
  if (filters.status) {
    params.push(filters.status);
    where.push(`i.status = $${params.length}`);
  }
  if (filters.project_id) {
    params.push(filters.project_id);
    where.push(`i.project_id = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(
      `(i.identifier ILIKE $${params.length} OR i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`,
    );
  }
  params.push(limit);
  const r = await getPool().query(
    `SELECT i.*, COALESCE(array_agg(il.label_id) FILTER (WHERE il.label_id IS NOT NULL), '{}') AS label_ids
     FROM issues i
     LEFT JOIN issue_labels il ON il.issue_id = i.id
     WHERE ${where.join(" AND ")}
     GROUP BY i.id
     ORDER BY i.updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((row) =>
    mapIssue({
      ...row,
      label_ids: row.label_ids ?? [],
    }),
  );
}

export async function getIssue(auth: AuthContext, idOrIdentifier: string) {
  const r = await getPool().query(
    `SELECT i.*, COALESCE(array_agg(il.label_id) FILTER (WHERE il.label_id IS NOT NULL), '{}') AS label_ids
     FROM issues i
     LEFT JOIN issue_labels il ON il.issue_id = i.id
     WHERE i.team_id = $1 AND (i.id::text = $2 OR i.identifier = $2)
     GROUP BY i.id`,
    [auth.teamId, idOrIdentifier],
  );
  if (!r.rows[0]) {
    throw new AppError("not_found", `Issue not found: ${idOrIdentifier}`, 404);
  }
  return mapIssue(r.rows[0]);
}

export async function createIssue(auth: AuthContext, input: CreateIssueInput) {
  return withTransaction(async (client) => {
    const team = await client.query<{ key: string; issue_counter: number }>(
      `SELECT key, issue_counter FROM teams WHERE id = $1 FOR UPDATE`,
      [auth.teamId],
    );
    if (!team.rows[0]) {
      throw new AppError("team_missing", "Team not found", 500);
    }
    const number = team.rows[0].issue_counter + 1;
    const identifier = `${team.rows[0].key}-${number}`;
    await client.query(`UPDATE teams SET issue_counter = $2 WHERE id = $1`, [
      auth.teamId,
      number,
    ]);

    const ins = await client.query<IssueRow>(
      `INSERT INTO issues (
         team_id, project_id, number, identifier, title, description,
         status, priority, assignee_id, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        auth.teamId,
        input.project_id ?? null,
        number,
        identifier,
        input.title,
        input.description ?? "",
        input.status ?? "backlog",
        input.priority ?? "none",
        input.assignee_id ?? null,
        auth.createdBy,
      ],
    );
    const issue = ins.rows[0];
    await setLabels(client, issue.id, input.label_ids ?? []);
    const label_ids = input.label_ids ?? [];
    const mapped = mapIssue({ ...issue, label_ids });
    await enqueue(client, "issue.created", { issue: mapped });
    return mapped;
  });
}

export async function updateIssue(
  auth: AuthContext,
  idOrIdentifier: string,
  input: UpdateIssueInput,
) {
  return withTransaction(async (client) => {
    const cur = await client.query<IssueRow>(
      `SELECT * FROM issues WHERE team_id = $1 AND (id::text = $2 OR identifier = $2) FOR UPDATE`,
      [auth.teamId, idOrIdentifier],
    );
    if (!cur.rows[0]) {
      throw new AppError("not_found", `Issue not found: ${idOrIdentifier}`, 404);
    }
    const before = cur.rows[0];
    const next = {
      title: input.title ?? before.title,
      description: input.description ?? before.description,
      status: (input.status ?? before.status) as IssueStatus,
      priority: (input.priority ?? before.priority) as IssuePriority,
      project_id:
        input.project_id !== undefined ? input.project_id : before.project_id,
      assignee_id:
        input.assignee_id !== undefined ? input.assignee_id : before.assignee_id,
    };
    const upd = await client.query<IssueRow>(
      `UPDATE issues SET
         title = $2, description = $3, status = $4, priority = $5,
         project_id = $6, assignee_id = $7, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        before.id,
        next.title,
        next.description,
        next.status,
        next.priority,
        next.project_id,
        next.assignee_id,
      ],
    );
    if (input.label_ids) {
      await setLabels(client, before.id, input.label_ids);
    }
    const label_ids = input.label_ids ?? (await loadLabels(client, before.id));
    const mapped = mapIssue({ ...upd.rows[0], label_ids });
    await enqueue(client, "issue.updated", { issue: mapped });
    if (before.status !== mapped.status) {
      await enqueue(client, "issue.status_changed", {
        issue_id: mapped.id,
        identifier: mapped.identifier,
        from: before.status,
        to: mapped.status,
      });
    }
    return mapped;
  });
}

export async function listComments(auth: AuthContext, idOrIdentifier: string) {
  const issue = await getIssue(auth, idOrIdentifier);
  const r = await getPool().query(
    `SELECT id, issue_id, body, created_by, created_at
     FROM comments WHERE issue_id = $1 ORDER BY created_at ASC`,
    [issue.id],
  );
  return r.rows.map((row) => ({
    id: row.id,
    issue_id: row.issue_id,
    body: row.body,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
  }));
}

export async function addComment(
  auth: AuthContext,
  idOrIdentifier: string,
  input: CreateCommentInput,
) {
  return withTransaction(async (client) => {
    const cur = await client.query<{ id: string }>(
      `SELECT id FROM issues WHERE team_id = $1 AND (id::text = $2 OR identifier = $2)`,
      [auth.teamId, idOrIdentifier],
    );
    if (!cur.rows[0]) {
      throw new AppError("not_found", `Issue not found: ${idOrIdentifier}`, 404);
    }
    const issueId = cur.rows[0].id;
    const ins = await client.query(
      `INSERT INTO comments (issue_id, body, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, issue_id, body, created_by, created_at`,
      [issueId, input.body, auth.createdBy],
    );
    const row = ins.rows[0];
    const comment = {
      id: row.id,
      issue_id: row.issue_id,
      body: row.body,
      created_by: row.created_by,
      created_at: row.created_at.toISOString(),
    };
    await enqueue(client, "comment.created", { comment });
    return comment;
  });
}

export async function search(
  auth: AuthContext,
  q: string,
  limit = 25,
) {
  return listIssues(auth, { q, limit });
}
