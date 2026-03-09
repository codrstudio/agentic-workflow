import { Hono } from "hono";
import path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { readJSON, listDirs } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { type Project } from "../schemas/project.js";

const sprints = new Hono();

const PHASES = ["1-brainstorming", "2-specs", "3-prps"] as const;

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function sprintsDir(slug: string): string {
  return path.join(projectDir(slug), "sprints");
}

function sprintDir(slug: string, number: number): string {
  return path.join(sprintsDir(slug), `sprint-${number}`);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json")
    );
  } catch {
    return null;
  }
}

async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// GET /hub/projects/:slug/sprints — list sprints with file count per phase
sprints.get("/hub/projects/:slug/sprints", async (c) => {
  const slug = c.req.param("slug");

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const sprintsRoot = sprintsDir(slug);
  const dirs = await listDirs(sprintsRoot);

  // Filter only sprint-{n} directories and extract numbers
  const sprintEntries: { number: number; dir: string }[] = [];
  for (const dir of dirs) {
    const match = dir.match(/^sprint-(\d+)$/);
    if (match) {
      sprintEntries.push({ number: parseInt(match[1]!, 10), dir });
    }
  }

  sprintEntries.sort((a, b) => a.number - b.number);

  const results = [];
  for (const entry of sprintEntries) {
    const sDir = path.join(sprintsRoot, entry.dir);
    const phases: Record<string, number> = {};

    for (const phase of PHASES) {
      const phaseDir = path.join(sDir, phase);
      const files = await listFiles(phaseDir);
      phases[phase] = files.length;
    }

    // Check if features.json exists
    const featuresPath = path.join(sDir, "features.json");
    let featuresCount = 0;
    try {
      const features = await readJSON<unknown[]>(featuresPath);
      featuresCount = features.length;
    } catch {
      // no features.json
    }

    results.push({
      number: entry.number,
      phases,
      features_count: featuresCount,
    });
  }

  return c.json(results);
});

// GET /hub/projects/:slug/sprints/:number — sprint details with file list per phase
sprints.get("/hub/projects/:slug/sprints/:number", async (c) => {
  const slug = c.req.param("slug");
  const num = parseInt(c.req.param("number"), 10);

  if (isNaN(num) || num < 1) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const sDir = sprintDir(slug, num);
  if (!(await dirExists(sDir))) {
    return c.json({ error: "Sprint not found" }, 404);
  }

  const phases: Record<string, string[]> = {};
  for (const phase of PHASES) {
    const phaseDir = path.join(sDir, phase);
    phases[phase] = await listFiles(phaseDir);
  }

  // Check features.json
  let hasFeatures = false;
  try {
    await readJSON(path.join(sDir, "features.json"));
    hasFeatures = true;
  } catch {
    // no features
  }

  return c.json({
    number: num,
    phases,
    has_features: hasFeatures,
  });
});

// GET /hub/projects/:slug/sprints/:number/files/:phase/:filename — file content
sprints.get(
  "/hub/projects/:slug/sprints/:number/files/:phase/:filename",
  async (c) => {
    const slug = c.req.param("slug");
    const num = parseInt(c.req.param("number"), 10);
    const phase = c.req.param("phase");
    const filename = c.req.param("filename");

    if (isNaN(num) || num < 1) {
      return c.json({ error: "Invalid sprint number" }, 400);
    }

    const project = await loadProject(slug);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Validate phase is one of the known phases
    if (!PHASES.includes(phase as (typeof PHASES)[number])) {
      return c.json({ error: "Invalid phase" }, 400);
    }

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filePath = path.join(sprintDir(slug, num), phase, filename);

    try {
      const content = await readFile(filePath, "utf-8");
      const ext = path.extname(filename).toLowerCase();

      return c.json({
        filename,
        phase,
        sprint: num,
        content,
        type: ext === ".json" ? "json" : ext === ".md" ? "markdown" : "text",
      });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        return c.json({ error: "File not found" }, 404);
      }
      throw err;
    }
  }
);

// GET /hub/projects/:slug/sprints/:number/features — features.json parsed
sprints.get("/hub/projects/:slug/sprints/:number/features", async (c) => {
  const slug = c.req.param("slug");
  const num = parseInt(c.req.param("number"), 10);

  if (isNaN(num) || num < 1) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const featuresPath = path.join(sprintDir(slug, num), "features.json");

  try {
    const features = await readJSON<unknown[]>(featuresPath);
    return c.json(features);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return c.json({ error: "Features not found" }, 404);
    }
    throw err;
  }
});

export { sprints };
