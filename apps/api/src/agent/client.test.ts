import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readJobResultFromDisk } from "./client.js";

test("readJobResultFromDisk extracts assistant text", () => {
  const dir = mkdtempSync(join(tmpdir(), "std-job-"));
  const jobId = "a".repeat(32);
  mkdirSync(join(dir, jobId));
  writeFileSync(
    join(dir, jobId, "out.jsonl"),
    [
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "已修好登入。" }] },
      }),
      JSON.stringify({ type: "result", result: "測試通過。" }),
    ].join("\n"),
  );
  const text = readJobResultFromDisk(dir, jobId);
  assert.match(text, /已修好登入/);
  assert.match(text, /測試通過/);
});
