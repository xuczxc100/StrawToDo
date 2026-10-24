const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";

function getKey(): string {
  return localStorage.getItem("strawtodo_api_key") || "";
}

export function setApiKey(key: string) {
  localStorage.setItem("strawtodo_api_key", key);
}

export function getApiKey(): string {
  return getKey();
}

export async function loadUiConfig() {
  try {
    const res = await fetch(`${API_BASE}/v1/ui-config`);
    const data = (await res.json()) as { default_api_key?: string; version?: string };
    if (data.default_api_key && !getKey()) setApiKey(data.default_api_key);
    return data;
  } catch {
    return { version: "" };
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const key = getKey();
  if (key) headers.set("authorization", `Bearer ${key}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `HTTP ${res.status}`);
  }
  return data as T;
}

export type Issue = {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  issue_type: string;
  assignee_type: string;
  sort_order: number;
  project_id: string | null;
  updated_at: string;
};

export type Comment = {
  id: string;
  body: string;
  created_by: string;
  author_type: string;
  run_id?: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  cwd?: string;
};

export type Run = {
  id: string;
  issue_id: string;
  job_id: string | null;
  status: string;
  model: string;
  log_text: string;
  started_at: string | null;
  ended_at: string | null;
};

export const STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "canceled"] as const;
export const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  canceled: "Canceled",
};
