#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = (process.env.STRAWTODO_API_BASE || "http://localhost:3040").replace(/\/$/, "");
const API_KEY = process.env.STRAWTODO_API_KEY || "";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error("STRAWTODO_API_KEY is required");
  }
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${API_KEY}`);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

const server = new McpServer({
  name: "strawtodo",
  version: "0.1.0",
});

server.tool(
  "list_issues",
  "List StrawToDo issues with optional status/project filters",
  {
    status: z.string().optional(),
    project_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  async ({ status, project_id, limit }) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (project_id) q.set("project_id", project_id);
    if (limit) q.set("limit", String(limit));
    const data = await api<{ items: unknown[] }>(`/v1/issues?${q}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_issue",
  "Get an issue by UUID or identifier (e.g. STD-1)",
  { id: z.string() },
  async ({ id }) => {
    const data = await api(`/v1/issues/${encodeURIComponent(id)}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_issue",
  "Create a new issue (supports idempotency_key)",
  {
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    project_id: z.string().uuid().optional(),
    idempotency_key: z.string().optional(),
  },
  async (args) => {
    const headers: Record<string, string> = {};
    if (args.idempotency_key) headers["Idempotency-Key"] = args.idempotency_key;
    const data = await api(`/v1/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: args.title,
        description: args.description ?? "",
        status: args.status,
        priority: args.priority,
        project_id: args.project_id,
      }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_issue",
  "Update issue fields (status, title, priority, etc.)",
  {
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
  },
  async ({ id, ...patch }) => {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) body[k] = v;
    }
    const data = await api(`/v1/issues/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "add_comment",
  "Add a comment to an issue",
  { id: z.string(), body: z.string().min(1) },
  async ({ id, body }) => {
    const data = await api(`/v1/issues/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "search",
  "Search issues by text or identifier",
  { q: z.string().min(1) },
  async ({ q }) => {
    const data = await api<{ items: unknown[] }>(`/v1/search?q=${encodeURIComponent(q)}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
