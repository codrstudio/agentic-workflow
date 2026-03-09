import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  evaluateGate,
  GATE_TRANSITIONS,
  type GateTransition,
  type GateEvaluationResult,
} from "../lib/quality-gate-engine.js";

interface QualityGate extends GateEvaluationResult {
  overridden?: boolean;
  override_reason?: string;
  overridden_at?: string;
}

const qualityGates = new Hono();

function gatesDir(slug: string, sprintNumber: number): string {
  return path.join(
    config.projectsDir,
    slug,
    "quality-gates",
    `sprint-${sprintNumber}`,
  );
}

function gatePath(
  slug: string,
  sprintNumber: number,
  transition: GateTransition,
): string {
  return path.join(gatesDir(slug, sprintNumber), `${transition}.json`);
}

function sprintDir(slug: string, sprintNumber: number): string {
  return path.join(config.projectsDir, slug, "sprints", `sprint-${sprintNumber}`);
}

function isValidTransition(t: string): t is GateTransition {
  return GATE_TRANSITIONS.includes(t as GateTransition);
}

// POST /hub/projects/:slug/sprints/:number/gates/:transition/evaluate
qualityGates.post(
  "/hub/projects/:slug/sprints/:number/gates/:transition/evaluate",
  async (c) => {
    const slug = c.req.param("slug");
    const num = parseInt(c.req.param("number"), 10);
    const transition = c.req.param("transition");

    if (isNaN(num) || num < 1) {
      return c.json({ error: "Invalid sprint number" }, 400);
    }

    if (!isValidTransition(transition)) {
      return c.json(
        { error: `Invalid transition. Valid: ${GATE_TRANSITIONS.join(", ")}` },
        400,
      );
    }

    const sprint = sprintDir(slug, num);
    const result = await evaluateGate(sprint, transition);

    // Preserve override info if previously set
    let gate: QualityGate = { ...result };
    try {
      const existing = await readJSON<QualityGate>(
        gatePath(slug, num, transition),
      );
      if (existing.overridden) {
        gate.overridden = existing.overridden;
        gate.override_reason = existing.override_reason;
        gate.overridden_at = existing.overridden_at;
      }
    } catch {
      // No existing gate, that's fine
    }

    await writeJSON(gatePath(slug, num, transition), gate);

    return c.json(gate);
  },
);

// GET /hub/projects/:slug/sprints/:number/gates
qualityGates.get(
  "/hub/projects/:slug/sprints/:number/gates",
  async (c) => {
    const slug = c.req.param("slug");
    const num = parseInt(c.req.param("number"), 10);

    if (isNaN(num) || num < 1) {
      return c.json({ error: "Invalid sprint number" }, 400);
    }

    const gates: (QualityGate | { transition: GateTransition; status: "not_evaluated" })[] = [];

    for (const transition of GATE_TRANSITIONS) {
      try {
        const gate = await readJSON<QualityGate>(
          gatePath(slug, num, transition),
        );
        gates.push(gate);
      } catch {
        gates.push({ transition, status: "not_evaluated" });
      }
    }

    return c.json(gates);
  },
);

// GET /hub/projects/:slug/sprints/:number/gates/:transition
qualityGates.get(
  "/hub/projects/:slug/sprints/:number/gates/:transition",
  async (c) => {
    const slug = c.req.param("slug");
    const num = parseInt(c.req.param("number"), 10);
    const transition = c.req.param("transition");

    if (isNaN(num) || num < 1) {
      return c.json({ error: "Invalid sprint number" }, 400);
    }

    if (!isValidTransition(transition)) {
      return c.json(
        { error: `Invalid transition. Valid: ${GATE_TRANSITIONS.join(", ")}` },
        400,
      );
    }

    try {
      const gate = await readJSON<QualityGate>(
        gatePath(slug, num, transition),
      );
      return c.json(gate);
    } catch {
      return c.json({ transition, status: "not_evaluated" });
    }
  },
);

// POST /hub/projects/:slug/sprints/:number/gates/:transition/override
qualityGates.post(
  "/hub/projects/:slug/sprints/:number/gates/:transition/override",
  async (c) => {
    const slug = c.req.param("slug");
    const num = parseInt(c.req.param("number"), 10);
    const transition = c.req.param("transition");

    if (isNaN(num) || num < 1) {
      return c.json({ error: "Invalid sprint number" }, 400);
    }

    if (!isValidTransition(transition)) {
      return c.json(
        { error: `Invalid transition. Valid: ${GATE_TRANSITIONS.join(", ")}` },
        400,
      );
    }

    const body = await c.req.json<{ reason?: string }>();
    if (!body.reason || body.reason.trim() === "") {
      return c.json({ error: "Override reason is required" }, 400);
    }

    // Load existing gate or create a minimal one
    let gate: QualityGate;
    try {
      gate = await readJSON<QualityGate>(gatePath(slug, num, transition));
    } catch {
      // No evaluation yet — evaluate first
      const sprint = sprintDir(slug, num);
      const result = await evaluateGate(sprint, transition);
      gate = { ...result };
    }

    gate.overridden = true;
    gate.override_reason = body.reason.trim();
    gate.overridden_at = new Date().toISOString();

    await writeJSON(gatePath(slug, num, transition), gate);

    return c.json(gate);
  },
);

export { qualityGates };
