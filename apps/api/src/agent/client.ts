import { readFileSync } from "node:fs";
import { join } from "node:path";

export type JobStatus = {
  id: string;
  running: boolean;
  exit: number | null;
};

export type JobClient = {
  createJob(prompt: string, model: string, chatId: string): Promise<{ job_id: string }>;
  getJob(jobId: string): Promise<JobStatus>;
  readResult(jobId: string): Promise<string>;
};

type MockJob = {
  running: boolean;
  exit: number | null;
  result: string;
};

const mockJobs = new Map<string, MockJob>();
let mockImpl: JobClient | null = null;

export function setJobClientForTests(client: JobClient | null) {
  mockImpl = client;
}

export function getJobClient(): JobClient {
  if (mockImpl) return mockImpl;
  const mode = (process.env.AGENT_MODE || "").toLowerCase();
  if (mode === "mock" || !process.env.BRIDGE_URL) {
    return createMockClient();
  }
  return createBridgeClient();
}

export function createMockClient(opts?: { fail?: boolean; hang?: boolean }): JobClient {
  return {
    async createJob(_prompt, _model, _chatId) {
      const id = `mock${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
      mockJobs.set(id, {
        running: Boolean(opts?.hang),
        exit: opts?.hang ? null : opts?.fail ? 1 : 0,
        result: opts?.fail
          ? "模擬 Agent 失敗：測試未通過。"
          : "模擬 Agent 已完成。測試通過。狀態請保持 In Review。",
      });
      return { job_id: id };
    },
    async getJob(jobId) {
      const job = mockJobs.get(jobId);
      if (!job) return { id: jobId, running: false, exit: 1 };
      return { id: jobId, running: job.running, exit: job.exit };
    },
    async readResult(jobId) {
      return mockJobs.get(jobId)?.result || "";
    },
  };
}

function createBridgeClient(): JobClient {
  const base = (process.env.BRIDGE_URL || "http://127.0.0.1:8643").replace(/\/$/, "");
  const key = process.env.BRIDGE_API_KEY || "";
  const jobsDir = process.env.BRIDGE_JOBS_DIR || "/var/lib/cursor-openai-bridge/jobs";

  async function bridgeFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (key) headers.set("authorization", `Bearer ${key}`);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const res = await fetch(`${base}${path}`, { ...init, headers });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    if (!res.ok) {
      throw new Error(`bridge ${path} ${res.status}: ${text.slice(0, 400)}`);
    }
    return json;
  }

  return {
    async createJob(prompt, model, chatId) {
      const json = (await bridgeFetch("/v1/jobs", {
        method: "POST",
        body: JSON.stringify({
          model: model || "auto",
          chat_id: chatId,
          messages: [{ role: "user", content: prompt }],
        }),
      })) as { job_id?: string };
      if (!json.job_id) throw new Error("bridge did not return job_id");
      return { job_id: json.job_id };
    },
    async getJob(jobId) {
      const json = (await bridgeFetch(`/jobs/${jobId}`)) as {
        id: string;
        running: boolean;
        exit: number | null;
      };
      return { id: json.id, running: Boolean(json.running), exit: json.exit ?? null };
    },
    async readResult(jobId) {
      const fromDisk = readJobResultFromDisk(jobsDir, jobId);
      if (fromDisk) return fromDisk;
      return "";
    },
  };
}

export function readJobResultFromDisk(jobsDir: string, jobId: string): string {
  try {
    const raw = readFileSync(join(jobsDir, jobId, "out.jsonl"), "utf8");
    const chunks: string[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      let ev: {
        type?: string;
        result?: string;
        message?: { content?: Array<{ type?: string; text?: string }> };
      };
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === "assistant") {
        for (const part of ev.message?.content || []) {
          if (part.type === "text" && part.text?.trim()) chunks.push(part.text);
        }
      }
      if (ev.type === "result" && ev.result?.trim()) chunks.push(ev.result);
    }
    return chunks.join("\n").trim();
  } catch {
    return "";
  }
}
