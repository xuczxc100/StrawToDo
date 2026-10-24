const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";

export type Me = { username: string; auth: string };

export async function loadUiConfig() {
  try {
    const res = await fetch(`${API_BASE}/v1/ui-config`, { credentials: "include" });
    return (await res.json()) as { version?: string; login_required?: boolean };
  } catch {
    return { version: "" };
  }
}

export async function me(): Promise<Me | null> {
  const res = await fetch(`${API_BASE}/v1/me`, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

export async function login(username: string, password: string): Promise<Me> {
  const res = await fetch(`${API_BASE}/v1/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "登入失敗");
  }
  return data as Me;
}

export async function logout() {
  await fetch(`${API_BASE}/v1/logout`, { method: "POST", credentials: "include" });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/v1/login")) {
    if (typeof location !== "undefined" && !location.pathname.startsWith("/login")) {
      location.href = "/login";
    }
    throw new Error((data as { message?: string }).message || "請先登入");
  }
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
