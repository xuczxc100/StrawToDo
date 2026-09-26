import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CreateCommentSchema,
  CreateIssueSchema,
  CreateProjectSchema,
  UpdateIssueSchema,
} from "@strawtodo/shared";
import { requireApiKey, type AppVariables } from "./auth.js";
import { toErrorBody, AppError } from "./errors.js";
import { openApiDocument } from "./openapi/document.js";
import { lookupIdempotency, storeIdempotency } from "./idempotency.js";
import {
  addComment,
  createIssue,
  createProject,
  getIssue,
  listComments,
  listIssues,
  listProjects,
  search,
  updateIssue,
} from "./domain/issues.js";
import { generateApiKey, hashApiKey } from "./db/migrate.js";
import { getPool } from "./db/pool.js";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use(
    "*",
    cors({
      origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? ["*"],
      allowHeaders: ["Authorization", "Content-Type", "X-Api-Key", "Idempotency-Key"],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { code: err.code, message: err.message, details: err.details },
        err.status as 400,
      );
    }
    const { status, body } = toErrorBody(err);
    return c.json(body, status as 500);
  });

  app.get("/v1/health", (c) =>
    c.json({ ok: true, service: "strawtodo-api", version: "0.1.0" }),
  );

  app.get("/v1/openapi.json", (c) => c.json(openApiDocument));
  app.get("/openapi.json", (c) => c.json(openApiDocument));

  // Static OpenAPI docs (minimal)
  app.get("/docs", (c) =>
    c.html(`<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"/><title>StrawToDo OpenAPI</title>
<style>body{font-family:system-ui;background:#0f1218;color:#e8ecf4;margin:2rem}
a{color:#5b8def} pre{background:#171b24;padding:1rem;border-radius:8px;overflow:auto}</style>
</head><body>
<h1>StrawToDo OpenAPI</h1>
<p><a href="/v1/openapi.json">/v1/openapi.json</a></p>
<p>Agent-first Issue Tracker v0.1</p>
<pre id="spec">Loading…</pre>
<script>fetch('/v1/openapi.json').then(r=>r.json()).then(j=>{document.getElementById('spec').textContent=JSON.stringify(j,null,2)})</script>
</body></html>`),
  );

  const v1 = new Hono<{ Variables: AppVariables }>();
  v1.use("*", requireApiKey);

  v1.get("/projects", async (c) => {
    const items = await listProjects(c.get("auth"));
    return c.json({ items });
  });

  v1.post("/projects", async (c) => {
    const raw = await c.req.json();
    const parsed = CreateProjectSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("validation_error", "Invalid project", 400, parsed.error.flatten());
    }
    const project = await createProject(c.get("auth"), parsed.data);
    return c.json(project, 201);
  });

  v1.get("/issues", async (c) => {
    const items = await listIssues(c.get("auth"), {
      status: c.req.query("status") || undefined,
      project_id: c.req.query("project_id") || undefined,
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    });
    return c.json({ items });
  });

  v1.post("/issues", async (c) => {
    const idem = c.req.header("idempotency-key");
    const bodyText = await c.req.text();
    const path = "/v1/issues";
    if (idem) {
      try {
        const cached = await lookupIdempotency(idem, "POST", path, bodyText);
        if (cached) return c.json(cached.body as object, cached.status as 201);
      } catch (e) {
        throw new AppError("idempotency_conflict", (e as Error).message, 409);
      }
    }
    let raw: unknown;
    try {
      raw = JSON.parse(bodyText || "{}");
    } catch {
      throw new AppError("validation_error", "Invalid JSON", 400);
    }
    const parsed = CreateIssueSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("validation_error", "Invalid issue", 400, parsed.error.flatten());
    }
    const issue = await createIssue(c.get("auth"), parsed.data);
    if (idem) {
      await storeIdempotency(idem, "POST", path, bodyText, 201, issue);
    }
    return c.json(issue, 201);
  });

  v1.get("/issues/:id", async (c) => {
    const issue = await getIssue(c.get("auth"), c.req.param("id"));
    return c.json(issue);
  });

  v1.patch("/issues/:id", async (c) => {
    const raw = await c.req.json();
    const parsed = UpdateIssueSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("validation_error", "Invalid update", 400, parsed.error.flatten());
    }
    const issue = await updateIssue(c.get("auth"), c.req.param("id"), parsed.data);
    return c.json(issue);
  });

  v1.get("/issues/:id/comments", async (c) => {
    const items = await listComments(c.get("auth"), c.req.param("id"));
    return c.json({ items });
  });

  v1.post("/issues/:id/comments", async (c) => {
    const raw = await c.req.json();
    const parsed = CreateCommentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("validation_error", "Invalid comment", 400, parsed.error.flatten());
    }
    const comment = await addComment(c.get("auth"), c.req.param("id"), parsed.data);
    return c.json(comment, 201);
  });

  v1.get("/search", async (c) => {
    const q = c.req.query("q");
    if (!q) throw new AppError("validation_error", "q is required", 400);
    const items = await search(c.get("auth"), q);
    return c.json({ items });
  });

  v1.post("/api-keys", async (c) => {
    const raw = (await c.req.json().catch(() => ({}))) as { name?: string };
    const gen = generateApiKey();
    const auth = c.get("auth");
    await getPool().query(
      `INSERT INTO api_keys (workspace_id, name, key_prefix, key_hash)
       VALUES ($1, $2, $3, $4)`,
      [auth.workspaceId, raw.name || "agent", gen.prefix, gen.hash],
    );
    return c.json(
      {
        name: raw.name || "agent",
        key_prefix: gen.prefix,
        api_key: gen.raw,
        note: "Store this key now; it will not be shown again.",
      },
      201,
    );
  });

  // silence unused import if tree-shaken oddly
  void hashApiKey;

  app.route("/v1", v1);
  return app;
}
