import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./lib/config.js";

function installCrashHandlers() {
  process.on("uncaughtException", (err) => {
    console.error("[arc-server] uncaught exception:", err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[arc-server] unhandled rejection:", reason);
    process.exit(1);
  });
}

installCrashHandlers();

const port = config.serverPort;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[arc-server] listening on http://localhost:${info.port}`);
});
