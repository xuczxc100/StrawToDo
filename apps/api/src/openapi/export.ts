import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiDocument } from "./document.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../");
const outDir = join(root, "docs");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "openapi.json");
writeFileSync(out, JSON.stringify(openApiDocument, null, 2));
console.log("wrote", out);
