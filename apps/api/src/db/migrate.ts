import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getPool, closePool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `std_${randomBytes(24).toString("base64url")}`;
  return { raw, prefix: raw.slice(0, 12), hash: hashApiKey(raw) };
}

export async function migrate(): Promise<{
  workspaceId: string;
  teamId: string;
  bootstrapKey?: string;
}> {
  const pool = getPool();
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS key TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS cwd TEXT NOT NULL DEFAULT '';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_prompt TEXT NOT NULL DEFAULT '';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_type TEXT NOT NULL DEFAULT 'feature';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_type TEXT NOT NULL DEFAULT 'agent';
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_type TEXT NOT NULL DEFAULT 'user';
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS run_id UUID;
    CREATE TABLE IF NOT EXISTS runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      job_id TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      model TEXT NOT NULL DEFAULT 'auto',
      log_text TEXT NOT NULL DEFAULT '',
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_issues_sort ON issues(status, sort_order)`);

  const ws = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (name)
     SELECT 'Default'
     WHERE NOT EXISTS (SELECT 1 FROM workspaces)
     RETURNING id`,
  );
  let workspaceId = ws.rows[0]?.id;
  if (!workspaceId) {
    workspaceId = (
      await pool.query<{ id: string }>(`SELECT id FROM workspaces LIMIT 1`)
    ).rows[0].id;
  }

  const team = await pool.query<{ id: string }>(
    `INSERT INTO teams (workspace_id, key, name)
     SELECT $1, 'STD', 'StrawToDo'
     WHERE NOT EXISTS (SELECT 1 FROM teams WHERE workspace_id = $1)
     RETURNING id`,
    [workspaceId],
  );
  let teamId = team.rows[0]?.id;
  if (!teamId) {
    teamId = (
      await pool.query<{ id: string }>(
        `SELECT id FROM teams WHERE workspace_id = $1 LIMIT 1`,
        [workspaceId],
      )
    ).rows[0].id;
  }

  let bootstrapKey: string | undefined;
  const bootstrap = process.env.BOOTSTRAP_API_KEY?.trim();
  if (bootstrap) {
    const hash = hashApiKey(bootstrap);
    await pool.query(
      `INSERT INTO api_keys (workspace_id, name, key_prefix, key_hash)
       VALUES ($1, 'bootstrap', $2, $3)
       ON CONFLICT (key_hash) DO NOTHING`,
      [workspaceId, bootstrap.slice(0, 12), hash],
    );
    bootstrapKey = bootstrap;
  } else {
    const existing = await pool.query(`SELECT 1 FROM api_keys LIMIT 1`);
    if (existing.rowCount === 0) {
      const gen = generateApiKey();
      await pool.query(
        `INSERT INTO api_keys (workspace_id, name, key_prefix, key_hash)
         VALUES ($1, 'bootstrap', $2, $3)`,
        [workspaceId, gen.prefix, gen.hash],
      );
      bootstrapKey = gen.raw;
      console.log(`[strawtodo] generated bootstrap API key: ${gen.raw}`);
    }
  }

  const loginUser = (process.env.LOGIN_USER || "cz").trim().toLowerCase();
  const loginPassword = process.env.LOGIN_PASSWORD || "";
  if (loginPassword) {
    const passwordHash = bcrypt.hashSync(loginPassword, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [loginUser, passwordHash],
    );
  } else {
    const existingUser = await pool.query(`SELECT 1 FROM users LIMIT 1`);
    if (existingUser.rowCount === 0) {
      console.warn("[strawtodo] LOGIN_PASSWORD 未設，沒有登入帳號。請設環境變數後重啟。");
    }
  }

  return { workspaceId, teamId, bootstrapKey };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then((r) => {
      console.log("migrate ok", r.workspaceId, r.teamId);
      return closePool();
    })
    .catch(async (e) => {
      console.error(e);
      await closePool();
      process.exit(1);
    });
}
