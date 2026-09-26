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
  project_id: string | null;
  updated_at: string;
};

export type Comment = {
  id: string;
  body: string;
  created_by: string;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
};
