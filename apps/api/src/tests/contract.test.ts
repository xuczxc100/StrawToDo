import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool } from "../db/pool.js";

const API_KEY = process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me";

async function req(path: string, init: RequestInit = {}) {
  const app = createApp();
  const headers = new Headers(init.headers);
  if (!headers.has("authorization") && !path.includes("/health") && !path.includes("openapi")) {
    headers.set("authorization", `Bearer ${API_KEY}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
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
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL required for tests");
  }
  process.env.BOOTSTRAP_API_KEY = API_KEY;
  await migrate();
});

after(async () => {
  await closePool();
});

test("health", async () => {
  const { res, json } = await req("/v1/health");
  assert.equal(res.status, 200);
  assert.equal((json as { ok: boolean }).ok, true);
});

test("openapi export shape", async () => {
  const { res, json } = await req("/v1/openapi.json");
  assert.equal(res.status, 200);
  assert.equal((json as { openapi: string }).openapi, "3.0.3");
  assert.ok((json as { paths: object }).paths["/issues"]);
});

test("create + get + update issue", async () => {
  const created = await req("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Contract issue", description: "hi" }),
  });
  assert.equal(created.res.status, 201);
  const issue = created.json as { id: string; identifier: string };
  assert.match(issue.identifier, /^STD-\d+$/);

  const got = await req(`/v1/issues/${issue.identifier}`);
  assert.equal(got.res.status, 200);
  assert.equal((got.json as { title: string }).title, "Contract issue");

  const updated = await req(`/v1/issues/${issue.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "in_progress" }),
  });
  assert.equal(updated.res.status, 200);
  assert.equal((updated.json as { status: string }).status, "in_progress");
});

test("idempotency key prevents duplicate create", async () => {
  const key = `idem-${Date.now()}`;
  const body = JSON.stringify({ title: `Idem ${key}` });
  const a = await req("/v1/issues", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body,
  });
  const b = await req("/v1/issues", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body,
  });
  assert.equal(a.res.status, 201);
  assert.equal(b.res.status, 201);
  assert.equal(
    (a.json as { id: string }).id,
    (b.json as { id: string }).id,
  );
});

test("comment + search", async () => {
  const created = await req("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Searchable UniqueZebra99" }),
  });
  const id = (created.json as { identifier: string }).identifier;
  const comment = await req(`/v1/issues/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: "agent progress" }),
  });
  assert.equal(comment.res.status, 201);
  const found = await req(`/v1/search?q=UniqueZebra99`);
  assert.equal(found.res.status, 200);
  assert.ok(((found.json as { items: unknown[] }).items.length) >= 1);
});
