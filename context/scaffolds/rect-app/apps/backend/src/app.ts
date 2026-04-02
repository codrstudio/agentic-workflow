import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "./logger.js"
import { api } from "./routes/api.js"
import { sse } from "./routes/sse.js"

export const app = new Hono()

app.use("*", async (c, next) => {
  const start = Date.now()
  await next()
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  })
})
app.use(
  "*",
  cors({
    origin: [`http://localhost:${process.env.FRONTEND_PORT}`],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
)

app.get("/health", (c) => c.json({ status: "ok" }))

app.route("/api/v1", api)
app.route("/api/v1/sse", sse)
