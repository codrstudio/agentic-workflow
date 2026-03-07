import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  BoardConfigSchema,
  PatchBoardConfigBody,
  PatchFeatureBoardMetaBody,
  DEFAULT_COLUMNS,
  PRIORITY_ORDER,
  type BoardConfig,
  type FeatureBoardMeta,
  type BoardMetaDict,
  type FeatureWithMeta,
  type BoardColumnView,
  type BoardView,
} from "../schemas/board.js";
import { type Project } from "../schemas/project.js";

const board = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function sprintDir(slug: string, sprint: number): string {
  return path.join(projectDir(slug), "sprints", `sprint-${sprint}`);
}

function boardConfigPath(slug: string, sprint: number): string {
  return path.join(sprintDir(slug, sprint), "board-config.json");
}

function boardMetaPath(slug: string, sprint: number): string {
  return path.join(sprintDir(slug, sprint), "board-meta.json");
}

function featuresPath(slug: string, sprint: number): string {
  return path.join(sprintDir(slug, sprint), "features.json");
}

// --- Project loading ---

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(path.join(projectDir(slug), "project.json"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

// --- BoardConfig helpers ---

async function loadBoardConfig(
  slug: string,
  sprint: number
): Promise<BoardConfig> {
  try {
    return await readJSON<BoardConfig>(boardConfigPath(slug, sprint));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return default config
      return {
        project_id: slug,
        sprint,
        columns: DEFAULT_COLUMNS,
        routing_rules: [{ condition: "default", assignee: "agent" }],
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

// --- BoardMeta helpers ---

async function loadBoardMeta(
  slug: string,
  sprint: number
): Promise<BoardMetaDict> {
  try {
    return await readJSON<BoardMetaDict>(boardMetaPath(slug, sprint));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return {};
    throw err;
  }
}

// --- Feature interface (matches features.json shape) ---

interface RawFeature {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  agent: string;
  task: string;
  dependencies: string[];
  tests: string[];
  prp_path?: string;
  completed_at?: string;
}

// --- Column matching ---

function defaultMeta(): FeatureBoardMeta {
  return {
    assignee: "pending",
    priority: "medium",
    labels: [],
  };
}

function assignFeatureToColumn(
  feature: RawFeature,
  meta: FeatureBoardMeta,
  columns: BoardConfig["columns"]
): string {
  // Pass 1: match status_filter AND assignee_filter
  for (const col of columns) {
    if (!col.status_filter.includes(feature.status)) continue;
    if (col.assignee_filter && !col.assignee_filter.includes(meta.assignee)) continue;
    return col.id;
  }
  // Pass 2: match status_filter only (ignore assignee_filter)
  for (const col of columns) {
    if (col.status_filter.includes(feature.status)) return col.id;
  }
  // Fallback: first column
  return columns[0]?.id ?? "backlog";
}

function metaPriorityOrder(meta: FeatureBoardMeta): number {
  return PRIORITY_ORDER[meta.priority] ?? 99;
}

// --- Routes ---

// GET /hub/projects/:slug/board-config?sprint=N
board.get("/hub/projects/:slug/board-config", async (c) => {
  const slug = c.req.param("slug");
  const sprintParam = c.req.query("sprint");
  const sprint = parseInt(sprintParam ?? "", 10);

  if (!sprintParam || isNaN(sprint) || sprint < 1) {
    return c.json({ error: "Query param sprint is required and must be a positive integer" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const boardConfig = await loadBoardConfig(slug, sprint);
  return c.json(boardConfig);
});

// PATCH /hub/projects/:slug/board-config?sprint=N
board.patch("/hub/projects/:slug/board-config", async (c) => {
  const slug = c.req.param("slug");
  const sprintParam = c.req.query("sprint");
  const sprint = parseInt(sprintParam ?? "", 10);

  if (!sprintParam || isNaN(sprint) || sprint < 1) {
    return c.json({ error: "Query param sprint is required and must be a positive integer" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchBoardConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const existing = await loadBoardConfig(slug, sprint);

  const updated: BoardConfig = {
    ...existing,
    ...(parsed.data.columns !== undefined ? { columns: parsed.data.columns } : {}),
    ...(parsed.data.routing_rules !== undefined ? { routing_rules: parsed.data.routing_rules } : {}),
    updated_at: new Date().toISOString(),
  };

  await ensureDir(sprintDir(slug, sprint));
  await writeJSON(boardConfigPath(slug, sprint), updated);

  return c.json(updated);
});

// PATCH /hub/projects/:slug/sprints/:sprint/features/:featureId/board-meta
board.patch(
  "/hub/projects/:slug/sprints/:sprint/features/:featureId/board-meta",
  async (c) => {
    const slug = c.req.param("slug");
    const sprintParam = c.req.param("sprint");
    const featureId = c.req.param("featureId");
    const sprint = parseInt(sprintParam, 10);

    if (isNaN(sprint) || sprint < 1) {
      return c.json({ error: "Sprint must be a positive integer" }, 400);
    }

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchFeatureBoardMetaBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
    }

    const metaDict = await loadBoardMeta(slug, sprint);
    const existing = metaDict[featureId] ?? defaultMeta();

    const updated: FeatureBoardMeta = {
      ...existing,
      ...parsed.data,
    };

    metaDict[featureId] = updated;

    await ensureDir(sprintDir(slug, sprint));
    await writeJSON(boardMetaPath(slug, sprint), metaDict);

    return c.json(updated);
  }
);

// GET /hub/projects/:slug/board?sprint=N
board.get("/hub/projects/:slug/board", async (c) => {
  const slug = c.req.param("slug");
  const sprintParam = c.req.query("sprint");
  const sprint = parseInt(sprintParam ?? "", 10);

  if (!sprintParam || isNaN(sprint) || sprint < 1) {
    return c.json({ error: "Query param sprint is required and must be a positive integer" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Load features.json
  let rawFeatures: RawFeature[];
  try {
    rawFeatures = await readJSON<RawFeature[]>(featuresPath(slug, sprint));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return c.json({ error: "Sprint features not found" }, 404);
    }
    throw err;
  }

  const boardConfig = await loadBoardConfig(slug, sprint);
  const metaDict = await loadBoardMeta(slug, sprint);

  // Build column map (id -> features)
  const columnFeatures: Record<string, FeatureWithMeta[]> = {};
  for (const col of boardConfig.columns) {
    columnFeatures[col.id] = [];
  }

  for (const feature of rawFeatures) {
    const meta = metaDict[feature.id] ?? defaultMeta();
    const colId = assignFeatureToColumn(feature, meta, boardConfig.columns);

    if (!(colId in columnFeatures)) {
      columnFeatures[colId] = [];
    }

    columnFeatures[colId]!.push({
      id: feature.id,
      name: feature.name,
      description: feature.description,
      status: feature.status,
      priority: feature.priority,
      agent: feature.agent,
      task: feature.task,
      dependencies: feature.dependencies,
      tests: feature.tests,
      prp_path: feature.prp_path,
      completed_at: feature.completed_at,
      board_meta: meta,
    });
  }

  // Sort features within each column by board_meta.priority (critical > high > medium > low)
  for (const colId of Object.keys(columnFeatures)) {
    columnFeatures[colId]!.sort(
      (a, b) => metaPriorityOrder(a.board_meta) - metaPriorityOrder(b.board_meta)
    );
  }

  // Build response columns
  const columns: BoardColumnView[] = boardConfig.columns.map((col) => ({
    ...col,
    features: columnFeatures[col.id] ?? [],
  }));

  const response: BoardView = {
    config: boardConfig,
    columns,
  };

  return c.json(response);
});

export { board };
