#!/usr/bin/env bash
set -euo pipefail
container="${E2E_PG_CONTAINER:-strawtodo-db}"
user="${PGUSER:-strawtodo}"
if docker exec "$container" psql -U "$user" -d postgres -Atc \
  "SELECT 1 FROM pg_database WHERE datname='strawtodo_e2e'" | grep -qx 1; then
  exit 0
fi
docker exec "$container" psql -U "$user" -d postgres -c "CREATE DATABASE strawtodo_e2e"
