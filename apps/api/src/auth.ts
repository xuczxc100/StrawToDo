import { createHash } from "node:crypto";
import type { Context, Next } from "hono";
import { getPool } from "./db/pool.js";
import { hashApiKey } from "./db/migrate.js";
import { AppError } from "./errors.js";
import type { AuthContext } from "./domain/issues.js";

export type AppVariables = {
  auth: AuthContext;
};

export async function requireApiKey(c: Context<{ Variables: AppVariables }>, next: Next) {
  const header = c.req.header("authorization") || c.req.header("x-api-key") || "";
  let raw = "";
  if (header.toLowerCase().startsWith("bearer ")) {
    raw = header.slice(7).trim();
  } else if (header) {
    raw = header.trim();
  }
  if (!raw) {
    throw new AppError("unauthorized", "Missing API key", 401);
  }
  const hash = hashApiKey(raw);
  const r = await getPool().query<{
    id: string;
    workspace_id: string;
  }>(
    `SELECT id, workspace_id FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hash],
  );
  if (!r.rows[0]) {
    throw new AppError("unauthorized", "Invalid API key", 401);
  }
  const team = await getPool().query<{ id: string }>(
    `SELECT id FROM teams WHERE workspace_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [r.rows[0].workspace_id],
  );
  if (!team.rows[0]) {
    throw new AppError("team_missing", "No team for workspace", 500);
  }
  c.set("auth", {
    apiKeyId: r.rows[0].id,
    workspaceId: r.rows[0].workspace_id,
    teamId: team.rows[0].id,
    createdBy: `api_key:${r.rows[0].id}`,
  });
  await next();
}

export function requestHash(method: string, path: string, body: string): string {
  return createHash("sha256")
    .update(`${method}:${path}:${body}`)
    .digest("hex");
}
