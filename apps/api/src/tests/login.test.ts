import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool } from "../db/pool.js";

const USER = process.env.LOGIN_USER || "cz";
const PASS = process.env.LOGIN_PASSWORD || "strawtodo-local";

async function req(path: string, init: RequestInit = {}) {
  const app = createApp();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await app.request(path, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  process.env.LOGIN_USER = USER;
  process.env.LOGIN_PASSWORD = PASS;
  process.env.COOKIE_SECURE = "0";
  await migrate();
});

after(async () => {
  await closePool();
});

test("wrong password is 401", async () => {
  const { res } = await req("/v1/login", {
    method: "POST",
    body: JSON.stringify({ username: USER, password: "nope" }),
  });
  assert.equal(res.status, 401);
});

test("login sets session cookie and me works", async () => {
  const login = await req("/v1/login", {
    method: "POST",
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  assert.equal(login.res.status, 200);
  const cookie = login.res.headers.get("set-cookie") || "";
  assert.match(cookie, /std_session=/);
  const me = await req("/v1/me", { headers: { cookie } });
  assert.equal(me.res.status, 200);
  assert.equal((me.json as { username: string }).username, USER);
});

test("session can list issues", async () => {
  const login = await req("/v1/login", {
    method: "POST",
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const cookie = login.res.headers.get("set-cookie") || "";
  const issues = await req("/v1/issues", { headers: { cookie } });
  assert.equal(issues.res.status, 200);
  assert.ok(Array.isArray((issues.json as { items: unknown[] }).items));
});
