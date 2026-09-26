import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
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
