import { serve } from "@hono/node-server"
import { app } from "./app.js"
import { logger } from "./logger.js"

if (!process.env.BACKEND_PORT) throw new Error("BACKEND_PORT is not set")
const port = Number(process.env.BACKEND_PORT)

serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Backend running at http://localhost:${info.port}`)
})
