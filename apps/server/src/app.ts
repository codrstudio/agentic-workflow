import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { health } from "./routes/health.js";
import { projects } from "./routes/projects.js";
import { sources } from "./routes/sources.js";
import { sessions } from "./routes/sessions.js";
import { artifacts } from "./routes/artifacts.js";
import { sprints } from "./routes/sprints.js";
import { harness } from "./routes/harness.js";
import { reviews } from "./routes/reviews.js";
import { metrics } from "./routes/metrics.js";
import { contextProfiles } from "./routes/context-profiles.js";
import { context } from "./routes/context.js";
import { reviewAgents } from "./routes/review-agents.js";
import { agentReview } from "./routes/agent-review.js";
import { mcpServers } from "./routes/mcp-servers.js";
import { qualityGates } from "./routes/quality-gates.js";
import { snapshots } from "./routes/snapshots.js";
import { burnout } from "./routes/burnout.js";
import { taskComplexity } from "./routes/task-complexity.js";
import { artifactOrigins } from "./routes/artifact-origins.js";

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", requestLogger());

// Global error handler
app.onError(errorHandler);

// Routes
app.route("/api/v1", health);
app.route("/api/v1", projects);
app.route("/api/v1", sources);
app.route("/api/v1", sessions);
app.route("/api/v1", artifacts);
app.route("/api/v1", sprints);
app.route("/api/v1", harness);
app.route("/api/v1", reviews);
app.route("/api/v1", metrics);
app.route("/api/v1", contextProfiles);
app.route("/api/v1", context);
app.route("/api/v1", reviewAgents);
app.route("/api/v1", agentReview);
app.route("/api/v1", mcpServers);
app.route("/api/v1", qualityGates);
app.route("/api/v1", snapshots);
app.route("/api/v1", burnout);
app.route("/api/v1", taskComplexity);
app.route("/api/v1", artifactOrigins);

export { app };
