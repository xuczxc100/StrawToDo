import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { migrate } from "../db/migrate.js";
import { closePool } from "../db/pool.js";
import { setJobClientForTests, type JobClient } from "../agent/client.js";
import { notifyTelegramRun, tickRuns } from "../domain/runs.js";

const API_KEY = process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me";

function mockClient(opts: { hang?: boolean; fail?: boolean; result?: string }): JobClient {
  const jobs = new Map<string, { running: boolean; exit: number | null; result: string }>();
  return {
    async createJob() {
      const id = `m${crypto.randomUUID().replace(/-/g, "").slice(0, 31)}`;
      jobs.set(id, {
        running: Boolean(opts.hang),
        exit: opts.hang ? null : opts.fail ? 1 : 0,
        result: opts.result || (opts.fail ? "boom" : "修好了，測試通過。"),
      });
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
  await migrate();
});

after(async () => {
  setJobClientForTests(null);
  await closePool();
});

test("create three issues, reorder, identifiers increment", async () => {
  const stamp = `Reorder-${Date.now()}`;
  const a = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: `${stamp}-A`, status: "todo" }),
  });
  const b = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: `${stamp}-B`, status: "todo" }),
  });
  const c = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: `${stamp}-C`, status: "todo" }),
  });
  assert.equal(a.res.status, 201);
  const ids = [a, b, c].map((x) => (x.json as { identifier: string }).identifier);
  assert.match(ids[0], /^STD-\d+$/);
  const reorder = await api("/v1/issues/reorder", {
    method: "POST",
    body: JSON.stringify({ status: "todo", ids: [ids[2], ids[0], ids[1]] }),
  });
  assert.equal(reorder.res.status, 200);
  const listed = await api("/v1/issues?status=todo");
  const titles = (listed.json as { items: Array<{ title: string }> }).items
    .filter((i) => i.title.startsWith(stamp))
    .map((i) => i.title);
  assert.deepEqual(titles, [`${stamp}-C`, `${stamp}-A`, `${stamp}-B`]);
});

test("successful run writes agent comment and moves to in_review", async () => {
  setJobClientForTests(mockClient({}));
  const created = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Run success", status: "todo" }),
  });
  const id = (created.json as { identifier: string }).identifier;
  const run = await api(`/v1/issues/${id}/runs`, { method: "POST", body: "{}" });
  assert.equal(run.res.status, 201);
  const mid = await api(`/v1/issues/${id}`);
  assert.equal((mid.json as { status: string }).status, "in_progress");
  const settled = await tickRuns();
  assert.ok(settled >= 1);
  const after = await api(`/v1/issues/${id}`);
  assert.equal((after.json as { status: string }).status, "in_review");
  const comments = await api(`/v1/issues/${id}/comments`);
  const items = (comments.json as { items: Array<{ author_type: string; body: string }> }).items;
  assert.ok(items.some((c) => c.author_type === "agent" && c.body.includes("測試通過")));
});

test("two issues can run at the same time; same issue is 409", async () => {
  setJobClientForTests(mockClient({ hang: true }));
  const first = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Hang one", status: "todo" }),
  });
  const second = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Hang two", status: "todo" }),
  });
  const aId = (first.json as { identifier: string }).identifier;
  const bId = (second.json as { identifier: string }).identifier;
  const a = await api(`/v1/issues/${aId}/runs`, { method: "POST", body: "{}" });
  assert.equal(a.res.status, 201);
  const b = await api(`/v1/issues/${bId}/runs`, { method: "POST", body: "{}" });
  assert.equal(b.res.status, 201);
  const again = await api(`/v1/issues/${aId}/runs`, { method: "POST", body: "{}" });
  assert.equal(again.res.status, 409);
  await api(`/v1/runs/${(a.json as { id: string }).id}/cancel`, { method: "POST" });
  await api(`/v1/runs/${(b.json as { id: string }).id}/cancel`, { method: "POST" });
});

test("failed run stays out of done and keeps error comment", async () => {
  setJobClientForTests(mockClient({ fail: true }));
  const created = await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Run fail", status: "todo", issue_type: "bug" }),
  });
  const id = (created.json as { identifier: string }).identifier;
  const run = await api(`/v1/issues/${id}/runs`, { method: "POST", body: "{}" });
  assert.equal(run.res.status, 201);
  await tickRuns();
  const after = await api(`/v1/issues/${id}`);
  assert.equal((after.json as { status: string }).status, "todo");
  assert.notEqual((after.json as { status: string }).status, "done");
  const comments = await api(`/v1/issues/${id}/comments`);
  const items = (comments.json as { items: Array<{ body: string }> }).items;
  assert.ok(items.some((c) => /失敗|boom/.test(c.body)));
});

test("telegram notify no-ops without env and calls sender when set", async () => {
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;
  const prevChat = process.env.TELEGRAM_NOTIFY_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_NOTIFY_CHAT_ID;
  assert.equal(await notifyTelegramRun("STD-1", "succeeded", "ok"), false);
  process.env.TELEGRAM_BOT_TOKEN = "t";
  process.env.TELEGRAM_NOTIFY_CHAT_ID = "1";
  const sent: string[] = [];
  assert.equal(
    await notifyTelegramRun("STD-1", "succeeded", "修好了", async (_t, _c, text) => {
      sent.push(text);
    }),
    true,
  );
  assert.match(sent[0], /STD-1/);
  if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = prevToken;
  if (prevChat === undefined) delete process.env.TELEGRAM_NOTIFY_CHAT_ID;
  else process.env.TELEGRAM_NOTIFY_CHAT_ID = prevChat;
});

test("queue starts next todo", async () => {
  setJobClientForTests(mockClient({}));
  await api("/v1/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Queue next", status: "todo" }),
  });
  const queued = await api("/v1/queue/start", { method: "POST", body: "{}" });
  assert.equal(queued.res.status, 201);
  assert.ok((queued.json as { id: string }).id);
  await tickRuns();
});
