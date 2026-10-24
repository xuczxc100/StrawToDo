#!/usr/bin/env bash
# Version format a.b.c.d (d = preview build, 0 = release).
# Usage: bump-version.sh [preview|patch|minor|major|release|set <a.b.c.d>]  (default: preview)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

current="$(tr -d '[:space:]' < VERSION)"
IFS=. read -r a b c d <<<"$current"
mode="${1:-preview}"

case "$mode" in
  preview) d=$((d + 1)) ;;
  patch)   c=$((c + 1)); d=1 ;;
  minor)   b=$((b + 1)); c=0; d=1 ;;
  major)   a=$((a + 1)); b=0; c=0; d=1 ;;
  release) d=0 ;;
  set)
    [[ "${2:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: $0 set a.b.c.d" >&2; exit 1; }
    IFS=. read -r a b c d <<<"$2" ;;
  *) echo "unknown mode: $mode" >&2; exit 1 ;;
esac

next="$a.$b.$c.$d"
if [[ "$d" == "0" ]]; then semver="$a.$b.$c"; else semver="$a.$b.$c-$d"; fi
echo "$next" > VERSION

for pkg in package.json apps/api/package.json apps/web/package.json apps/mcp/package.json packages/shared/package.json; do
  [[ -f "$pkg" ]] || continue
  node -e '
    const fs = require("fs");
    const [file, v] = process.argv.slice(1);
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    j.version = v;
    if (j.dependencies && j.dependencies["@strawtodo/shared"]) {
      j.dependencies["@strawtodo/shared"] = v;
    }
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
  ' "$pkg" "$semver"
done

if [[ -f package-lock.json ]]; then
  node -e '
    const fs = require("fs");
    const v = process.argv[1];
    const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
    lock.version = v;
    if (lock.packages && lock.packages[""]) lock.packages[""].version = v;
    fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
  ' "$semver"
fi

echo "$current -> $next"
