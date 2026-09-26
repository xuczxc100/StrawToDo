import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool } from "../db/pool.js";

const API_KEY = process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me";

async function api(path: string, init: RequestInit = {}) {
  const app = createApp();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${API_KEY}`);
  if (init.body) headers.set("content-type", "application/json");
  const res = await app.request(path, { ...init, headers });
  const json = await res.json();
  return { res, json };
}

before(async () => {
  process.env.BOOTSTRAP_API_KEY = API_KEY;
  await migrate();
});

after(async () => {
  await closePool();
});

test("agent flow: create → update → comment → done", async () => {
  const created = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Agent E2E", status: "todo" }),
  });
  assert.equal(created.res.status, 201);
  const id = (created.json as { identifier: string }).identifier;

  const updated = await api(`/v1/issues/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "in_progress" }),
  });
  assert.equal((updated.json as { status: string }).status, "in_progress");

  const comment = await api(`/v1/issues/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: "working on it" }),
  });
  assert.equal(comment.res.status, 201);

  const done = await api(`/v1/issues/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done" }),
  });
  assert.equal((done.json as { status: string }).status, "done");

  const comments = await api(`/v1/issues/${id}/comments`);
  assert.ok(((comments.json as { items: unknown[] }).items.length) >= 1);
});
