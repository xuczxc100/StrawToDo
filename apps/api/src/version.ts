import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function appVersion(): string {
  if (process.env.APP_VERSION?.trim()) return process.env.APP_VERSION.trim();
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "../../../VERSION"),
    join(here, "../../../../VERSION"),
    "/app/VERSION",
  ]) {
    try {
      const v = readFileSync(candidate, "utf8").trim();
      if (v) return v;
    } catch {
      /* next */
    }
  }
  return "0.2.0.1";
}
