import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { health } from "./routes/health.js";

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", requestLogger());

// Global error handler
app.onError(errorHandler);

// Routes
app.route("/api/v1", health);

export { app };
