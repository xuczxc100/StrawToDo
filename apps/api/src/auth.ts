import { createHash, randomBytes } from "node:crypto";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { getPool } from "./db/pool.js";
import { hashApiKey } from "./db/migrate.js";
import { AppError } from "./errors.js";
import type { AuthContext } from "./domain/issues.js";

export const SESSION_COOKIE = "std_session";
const SESSION_DAYS = 30;

export type AppVariables = {
  auth: AuthContext;
};

function cookieSecure(c: Context): boolean {
  if (process.env.COOKIE_SECURE === "0") return false;
  if (process.env.COOKIE_SECURE === "1") return true;
  return c.req.header("x-forwarded-proto") === "https";
}

function sessionOpts(c: Context) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: cookieSecure(c),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

async function authFromApiKey(raw: string): Promise<AuthContext | null> {
  const hash = hashApiKey(raw);
  const r = await getPool().query<{ id: string; workspace_id: string }>(
    `SELECT id, workspace_id FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hash],
  );
  if (!r.rows[0]) return null;
  const team = await getPool().query<{ id: string }>(
    `SELECT id FROM teams WHERE workspace_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [r.rows[0].workspace_id],
  );
  if (!team.rows[0]) return null;
  return {
    apiKeyId: r.rows[0].id,
    workspaceId: r.rows[0].workspace_id,
    teamId: team.rows[0].id,
    createdBy: `api_key:${r.rows[0].id}`,
  };
}

async function authFromSession(token: string): Promise<AuthContext | null> {
  const r = await getPool().query<{
    user_id: string;
    username: string;
    workspace_id: string;
    team_id: string;
  }>(
    `SELECT s.user_id, u.username, t.workspace_id, t.id AS team_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN teams t ON t.workspace_id = (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1)
     WHERE s.id = $1 AND s.expires_at > now()
     ORDER BY t.created_at ASC
     LIMIT 1`,
    [token],
  );
  if (!r.rows[0]) return null;
  return {
    apiKeyId: `user:${r.rows[0].user_id}`,
    workspaceId: r.rows[0].workspace_id,
    teamId: r.rows[0].team_id,
    createdBy: `user:${r.rows[0].username}`,
  };
}

export async function resolveAuth(c: Context): Promise<AuthContext | null> {
  const header = c.req.header("authorization") || c.req.header("x-api-key") || "";
  let raw = "";
  if (header.toLowerCase().startsWith("bearer ")) raw = header.slice(7).trim();
  else if (header) raw = header.trim();
  if (raw) return authFromApiKey(raw);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) return authFromSession(token);
  return null;
}

export async function requireApiKey(c: Context<{ Variables: AppVariables }>, next: Next) {
  const auth = await resolveAuth(c);
  if (!auth) throw new AppError("unauthorized", "請先登入", 401);
  c.set("auth", auth);
  await next();
}

export async function loginWithPassword(username: string, password: string) {
  const user = await getPool().query<{ id: string; username: string; password_hash: string }>(
    `SELECT id, username, password_hash FROM users WHERE username = $1`,
    [username.trim().toLowerCase()],
  );
  if (!user.rows[0] || !bcrypt.compareSync(password, user.rows[0].password_hash)) {
    throw new AppError("unauthorized", "帳號或密碼不對", 401);
  }
  const token = randomBytes(32).toString("hex");
  await getPool().query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [token, user.rows[0].id, String(SESSION_DAYS)],
  );
  return { token, username: user.rows[0].username };
}

export async function attachSession(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, sessionOpts(c));
}

export async function clearSession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await getPool().query(`DELETE FROM sessions WHERE id = $1`, [token]);
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function sessionUser(c: Context) {
  const auth = await resolveAuth(c);
  if (!auth) throw new AppError("unauthorized", "請先登入", 401);
  const name = auth.createdBy.startsWith("user:")
    ? auth.createdBy.slice(5)
    : "api";
  return { username: name, auth: "ok" as const };
}

export function requestHash(method: string, path: string, body: string): string {
  return createHash("sha256")
    .update(`${method}:${path}:${body}`)
    .digest("hex");
}
