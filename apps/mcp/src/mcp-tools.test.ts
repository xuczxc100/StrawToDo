import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("mcp source registers six tools", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "index.ts"),
    "utf8",
  );
  for (const name of [
    "list_issues",
    "get_issue",
    "create_issue",
    "update_issue",
    "add_comment",
    "search",
  ]) {
    assert.match(src, new RegExp(`"${name}"`));
  }
});
