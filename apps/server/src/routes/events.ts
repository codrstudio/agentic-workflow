import { Hono } from "hono";
import { createSSEHandler } from "../events/sse.js";

const events = new Hono();

/**
 * GET /api/v1/system/events
 * Server-Sent Events endpoint para stream de eventos do sistema
 *
 * Query params:
 *   - token: JWT token (alternativa a Bearer header)
 */
events.get("/system/events", createSSEHandler("system"));

export { events };
