import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool } from "../db/pool.js";
import { setJobClientForTests, type JobClient } from "../agent/client.js";
import { tickRuns } from "../domain/runs.js";

const API_KEY = process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me";

function mockClient(): JobClient {
  const jobs = new Map<string, { running: boolean; exit: number | null; result: string }>();
  return {
    async createJob() {
      const id = `m${crypto.randomUUID().replace(/-/g, "").slice(0, 31)}`;
      jobs.set(id, { running: false, exit: 0, result: "修好了，測試通過。" });
      return { job_id: id };
    },
    async getJob(jobId) {
      const job = jobs.get(jobId);
      if (!job) return { id: jobId, running: false, exit: 1 };
      return { id: jobId, running: job.running, exit: job.exit };
    },
    async readResult(jobId) {
      return jobs.get(jobId)?.result || "";
    },
  };
}

async function api(path: string, init: RequestInit = {}) {
  const app = createApp();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${API_KEY}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await app.request(path, { ...init, headers });
  const json = await res.json();
  return { res, json };
}

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  process.env.BOOTSTRAP_API_KEY = API_KEY;
  process.env.AGENT_MODE = "mock";
  setJobClientForTests(mockClient());
  await migrate();
});

after(async () => {
  setJobClientForTests(null);
  await closePool();
});

test("telegram inbox create without run stays todo", async () => {
  const stamp = `TG-norun-${Date.now()}`;
  const { res, json } = await api("/v1/telegram/todos", {
    method: "POST",
    body: JSON.stringify({ title: stamp, description: "from telegram", source_ref: "tg:test" }),
  });
  assert.equal(res.status, 201);
  const body = json as { items: Array<{ identifier: string; status: string; source: string }>; run: null; queued: boolean };
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].status, "todo");
  assert.equal(body.items[0].source, "telegram");
  assert.equal(body.run, null);
  assert.equal(body.queued, true);
});

test("telegram inbox create+run then in_review", async () => {
  const stamp = `TG-run-${Date.now()}`;
  const created = await api("/v1/telegram/todos", {
    method: "POST",
    body: JSON.stringify({ title: stamp, run: true }),
  });
  assert.equal(created.res.status, 201);
  const body = created.json as {
    items: Array<{ identifier: string }>;
    run: { id: string } | null;
    busy: boolean;
  };
  assert.ok(body.run || body.busy);
  if (body.run) {
    await tickRuns();
    const show = await api(`/v1/telegram/todos/${body.items[0].identifier}`);
    assert.equal(show.res.status, 200);
    const detail = show.json as { issue: { status: string }; comments: Array<{ body: string }> };
    assert.equal(detail.issue.status, "in_review");
    assert.ok(detail.comments.some((c) => c.body.includes("測試通過")));
  }
});

test("telegram batch two run:true both start", async () => {
  const stamp = `TG-batch-${Date.now()}`;
  const { res, json } = await api("/v1/telegram/todos", {
    method: "POST",
    body: JSON.stringify({
      items: [
        { title: `${stamp}-A`, run: true },
        { title: `${stamp}-B`, run: true },
      ],
    }),
  });
  assert.equal(res.status, 201);
  const body = json as {
    items: Array<{ identifier: string; title: string }>;
    runs: Array<{ id: string }>;
    message: string;
  };
  assert.equal(body.items.length, 2);
  assert.equal(body.runs.length, 2);
  const queue = await api("/v1/telegram/queue");
  assert.equal(queue.res.status, 200);
  const q = queue.json as { active_runs: Array<{ id: string }>; todos: Array<{ title: string }> };
  assert.ok(Array.isArray(q.active_runs));
  assert.ok(q.active_runs.length >= 2);
});

test("telegram delete removes todo and rejects running", async () => {
  const hang = {
    async createJob() {
      return { job_id: `m${crypto.randomUUID().replace(/-/g, "").slice(0, 31)}` };
    },
    async getJob(jobId: string) {
      return { id: jobId, running: true, exit: null };
    },
    async readResult() {
      return "";
    },
  };
  setJobClientForTests(hang);
  const idle = await api("/v1/telegram/todos", {
    method: "POST",
    body: JSON.stringify({ title: `TG-del-${Date.now()}` }),
  });
  const idleId = (idle.json as { items: Array<{ identifier: string }> }).items[0].identifier;
  const gone = await api(`/v1/telegram/todos/${idleId}`, { method: "DELETE" });
  assert.equal(gone.res.status, 200);
  assert.equal((gone.json as { deleted: string }).deleted, idleId);
  const missing = await api(`/v1/telegram/todos/${idleId}`);
  assert.equal(missing.res.status, 404);

  const running = await api("/v1/telegram/todos", {
    method: "POST",
    body: JSON.stringify({ title: `TG-delrun-${Date.now()}`, run: true }),
  });
  const runId = (running.json as { items: Array<{ identifier: string }> }).items[0].identifier;
  const blocked = await api(`/v1/telegram/todos/${runId}`, { method: "DELETE" });
  assert.equal(blocked.res.status, 409);
  setJobClientForTests(mockClient());
});

test("telegram inbox rejects empty title", async () => {
  const { res } = await api("/v1/telegram/todos", {
    method: "POST",
    body: JSON.stringify({ title: "" }),
  });
  assert.equal(res.status, 400);
});
