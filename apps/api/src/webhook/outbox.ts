import { createHmac } from "node:crypto";
import { getPool } from "../db/pool.js";

const MAX_ATTEMPTS = 8;

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverOutboxOnce(): Promise<number> {
  const url = process.env.WEBHOOK_URL?.trim();
  const secret = process.env.WEBHOOK_SECRET?.trim() || "change-me-webhook-secret";
  if (!url) {
    return 0;
  }
  const pool = getPool();
  const pending = await pool.query<{
    id: string;
    event_type: string;
    payload: unknown;
    attempts: number;
  }>(
    `SELECT id, event_type, payload, attempts FROM webhook_outbox
     WHERE delivered_at IS NULL AND next_attempt_at <= now() AND attempts < $1
     ORDER BY created_at ASC
     LIMIT 20
     FOR UPDATE SKIP LOCKED`,
    [MAX_ATTEMPTS],
  );

  // FOR UPDATE SKIP LOCKED needs a transaction — use simpler claim without lock for v0.1
  void pending;

  const rows = await pool.query<{
    id: string;
    event_type: string;
    payload: unknown;
    attempts: number;
  }>(
    `SELECT id, event_type, payload, attempts FROM webhook_outbox
     WHERE delivered_at IS NULL AND next_attempt_at <= now() AND attempts < $1
     ORDER BY created_at ASC
     LIMIT 20`,
    [MAX_ATTEMPTS],
  );

  let delivered = 0;
  for (const row of rows.rows) {
    const body = JSON.stringify(row.payload);
    const signature = sign(body, secret);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-strawtodo-signature": signature,
          "x-strawtodo-event": row.event_type,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await pool.query(
        `UPDATE webhook_outbox SET delivered_at = now(), last_error = NULL WHERE id = $1`,
        [row.id],
      );
      delivered += 1;
    } catch (e) {
      const attempts = row.attempts + 1;
      const delaySec = Math.min(3600, 2 ** attempts);
      await pool.query(
        `UPDATE webhook_outbox
         SET attempts = $2,
             next_attempt_at = now() + ($3 || ' seconds')::interval,
             last_error = $4
         WHERE id = $1`,
        [row.id, attempts, String(delaySec), e instanceof Error ? e.message : String(e)],
      );
    }
  }
  return delivered;
}

export function startOutboxWorker(intervalMs = 2000): NodeJS.Timeout {
  return setInterval(() => {
    deliverOutboxOnce().catch((e) => console.error("[outbox]", e));
  }, intervalMs);
}
