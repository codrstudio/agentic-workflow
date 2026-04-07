import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { subscribe } from "../lib/event-bus.js"

export const sse = new Hono()

sse.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((event, data) => {
      stream.writeSSE({ event, data: JSON.stringify(data) })
    })

    stream.onAbort(() => {
      unsubscribe()
    })

    // Keep connection alive with periodic heartbeats
    while (true) {
      await stream.writeSSE({ event: "heartbeat", data: "" })
      await stream.sleep(30_000)
    }
  })
})
