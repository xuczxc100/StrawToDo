import { getPool } from "./db/pool.js";
import { requestHash } from "./auth.js";

export async function lookupIdempotency(
  key: string,
  method: string,
  path: string,
  body: string,
): Promise<{ status: number; body: unknown } | null> {
  const r = await getPool().query<{
    request_hash: string;
    response_status: number;
    response_body: unknown;
  }>(`SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE key = $1`, [
    key,
  ]);
  if (!r.rows[0]) return null;
  const hash = requestHash(method, path, body);
  if (r.rows[0].request_hash !== hash) {
    const err = new Error("Idempotency-Key reuse with different payload");
    (err as Error & { code: string; status: number }).code = "idempotency_conflict";
    (err as Error & { status: number }).status = 409;
    throw err;
  }
  return { status: r.rows[0].response_status, body: r.rows[0].response_body };
}

export async function storeIdempotency(
  key: string,
  method: string,
  path: string,
  body: string,
  status: number,
  responseBody: unknown,
): Promise<void> {
  const hash = requestHash(method, path, body);
  await getPool().query(
    `INSERT INTO idempotency_keys (key, method, path, request_hash, response_status, response_body)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [key, method, path, hash, status, JSON.stringify(responseBody)],
  );
}
