import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { emitEvent } from "../lib/event-bus.js"

const MessageSchema = z.object({
  content: z.string().min(1).max(1000),
})

export const api = new Hono()

api.get("/messages", (c) => {
  return c.json({ messages: [] })
})

api.post("/messages", zValidator("json", MessageSchema), (c) => {
  const { content } = c.req.valid("json")

  const message = {
    id: crypto.randomUUID(),
    content,
    createdAt: new Date().toISOString(),
  }

  emitEvent("message:created", message)

  return c.json(message, 201)
})
