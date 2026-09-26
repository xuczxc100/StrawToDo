import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { migrate } from "./db/migrate.js";
import { startOutboxWorker } from "./webhook/outbox.js";

const port = Number(process.env.PORT || 3040);

async function main() {
  await migrate();
  const app = createApp();
  startOutboxWorker(2000);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[strawtodo-api] listening on http://0.0.0.0:${info.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
