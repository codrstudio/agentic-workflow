import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { unlink, readdir, stat } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateReviewBody,
  UpdateReviewBody,
  UpdateReviewItemBody,
  type Review,
  type ReviewItem,
  type ReviewCriterion,
} from "../schemas/review.js";
import { type Project } from "../schemas/project.js";

const execFileAsync = promisify(execFile);

const reviews = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function reviewsDir(slug: string): string {
  return path.join(projectDir(slug), "reviews");
}

function reviewPath(slug: string, reviewId: string): string {
  return path.join(reviewsDir(slug), `${reviewId}.json`);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadReview(
  slug: string,
  reviewId: string
): Promise<Review | null> {
  try {
    return await readJSON<Review>(reviewPath(slug, reviewId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveReview(slug: string, review: Review): Promise<void> {
  await ensureDir(reviewsDir(slug));
  await writeJSON(reviewPath(slug, review.id), review);
}

async function listAllReviews(slug: string): Promise<Review[]> {
  const dir = reviewsDir(slug);
  let entries: string[];
  try {
    const files = await readdir(dir);
    entries = files.filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const results: Review[] = [];
  for (const file of entries) {
    try {
      const review = await readJSON<Review>(path.join(dir, file));
      results.push(review);
    } catch {
      // skip corrupted files
    }
  }

  return results.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

interface GitDiffEntry {
  status: string;
  file_path: string;
}

function gitStatusToDiffType(
  status: string
): "added" | "modified" | "deleted" {
  switch (status) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    default:
      return "modified";
  }
}

async function detectModifiedFiles(slug: string): Promise<ReviewItem[]> {
  // Try the workspace's repo dir for git diff
  const wsDir = path.join(config.workspacesDir, slug);
  const repoDir = path.join(wsDir, "repo");

  // Check if repo dir exists
  try {
    const s = await stat(repoDir);
    if (!s.isDirectory()) return [];
  } catch {
    return [];
  }

  try {
    // Get both staged and unstaged changes against HEAD
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--name-status", "HEAD"],
      { cwd: repoDir, timeout: 10000 }
    );

    const entries: GitDiffEntry[] = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const parts = line.split("\t");
        return {
          status: parts[0]?.charAt(0) ?? "M",
          file_path: parts[1] ?? "",
        };
      })
      .filter((e) => e.file_path !== "");

    return entries.map((entry) => ({
      id: randomUUID(),
      file_path: entry.file_path,
      diff_type: gitStatusToDiffType(entry.status),
      status: "pending" as const,
    }));
  } catch {
    // git diff failed (maybe no commits yet), return empty
    return [];
  }
}

// GET /hub/projects/:slug/reviews — list reviews, optional ?status= filter
reviews.get("/hub/projects/:slug/reviews", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let all = await listAllReviews(slug);

  const statusFilter = c.req.query("status");
  if (statusFilter) {
    all = all.filter((r) => r.status === statusFilter);
  }

  // Return summaries without full items for list
  const result = all.map((r) => {
    // Compute findings summary from agent_reviews if present
    const agentReviews = (r as Record<string, unknown>).agent_reviews as
      | Array<{
          status: string;
          findings: Array<{ severity: string; dismissed?: boolean }>;
        }>
      | undefined;

    let findings_summary:
      | { critical: number; warning: number; info: number; total: number }
      | undefined;

    if (agentReviews && agentReviews.length > 0) {
      const counts = { critical: 0, warning: 0, info: 0 };
      for (const ar of agentReviews) {
        if (ar.status === "completed" && Array.isArray(ar.findings)) {
          for (const f of ar.findings) {
            if (f.dismissed) continue;
            if (f.severity === "critical") counts.critical++;
            else if (f.severity === "warning") counts.warning++;
            else counts.info++;
          }
        }
      }
      findings_summary = {
        ...counts,
        total: counts.critical + counts.warning + counts.info,
      };
    }

    return {
      id: r.id,
      project_id: r.project_id,
      title: r.title,
      status: r.status,
      chat_session_id: r.chat_session_id,
      step_ref: r.step_ref,
      items_count: r.items.length,
      items_pending: r.items.filter((i) => i.status === "pending").length,
      criteria_count: r.criteria.length,
      criteria_checked: r.criteria.filter((cr) => cr.checked).length,
      findings_summary,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });

  return c.json(result);
});

// POST /hub/projects/:slug/reviews — create review with auto-detected files
reviews.post("/hub/projects/:slug/reviews", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateReviewBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { title, chat_session_id, step_ref } = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();

  // Auto-detect modified files via git diff
  const items = await detectModifiedFiles(slug);

  const review: Review = {
    id,
    project_id: project.id,
    title,
    status: "pending",
    chat_session_id,
    step_ref,
    items,
    criteria: [],
    created_at: now,
    updated_at: now,
  };

  await saveReview(slug, review);

  return c.json(review, 201);
});

// GET /hub/projects/:slug/reviews/:id — get review with items
reviews.get("/hub/projects/:slug/reviews/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const review = await loadReview(slug, id);
  if (!review) return c.json({ error: "Review not found" }, 404);

  return c.json(review);
});

// PATCH /hub/projects/:slug/reviews/:id — update status and criteria
reviews.patch("/hub/projects/:slug/reviews/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const review = await loadReview(slug, id);
  if (!review) return c.json({ error: "Review not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdateReviewBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updates = parsed.data;

  if (updates.status !== undefined) {
    review.status = updates.status;
  }

  if (updates.criteria !== undefined) {
    review.criteria = updates.criteria.map((cr) => ({
      id: cr.id ?? randomUUID(),
      label: cr.label,
      checked: cr.checked,
    }));
  }

  review.updated_at = new Date().toISOString();
  await saveReview(slug, review);

  return c.json(review);
});

// DELETE /hub/projects/:slug/reviews/:id — delete review
reviews.delete("/hub/projects/:slug/reviews/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const review = await loadReview(slug, id);
  if (!review) return c.json({ error: "Review not found" }, 404);

  try {
    await unlink(reviewPath(slug, id));
  } catch {
    // ignore if already gone
  }

  return c.body(null, 204);
});

// GET /hub/projects/:slug/reviews/:id/items/:itemId/diff — compute diff for a review item
reviews.get(
  "/hub/projects/:slug/reviews/:id/items/:itemId/diff",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const itemId = c.req.param("itemId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const review = await loadReview(slug, id);
    if (!review) return c.json({ error: "Review not found" }, 404);

    const item = review.items.find((i) => i.id === itemId);
    if (!item) return c.json({ error: "Review item not found" }, 404);

    const wsDir = path.join(config.workspacesDir, slug);
    const repoDir = path.join(wsDir, "repo");

    let before = "";
    let after = "";
    let unified_diff = "";

    try {
      if (item.diff_type === "added") {
        // New file — no "before", read current content as "after"
        const { stdout } = await execFileAsync(
          "git",
          ["show", `HEAD:${item.file_path}`],
          { cwd: repoDir, timeout: 10000 }
        );
        after = stdout;
      } else if (item.diff_type === "deleted") {
        // Deleted file — read from parent commit as "before", no "after"
        const { stdout } = await execFileAsync(
          "git",
          ["show", `HEAD~1:${item.file_path}`],
          { cwd: repoDir, timeout: 10000 }
        );
        before = stdout;
      } else {
        // Modified file — get before (HEAD~1) and after (HEAD)
        try {
          const beforeResult = await execFileAsync(
            "git",
            ["show", `HEAD~1:${item.file_path}`],
            { cwd: repoDir, timeout: 10000 }
          );
          before = beforeResult.stdout;
        } catch {
          // File may not exist in parent commit (newly added in HEAD)
          before = "";
        }

        try {
          const afterResult = await execFileAsync(
            "git",
            ["show", `HEAD:${item.file_path}`],
            { cwd: repoDir, timeout: 10000 }
          );
          after = afterResult.stdout;
        } catch {
          after = "";
        }
      }

      // Compute unified diff
      try {
        const diffResult = await execFileAsync(
          "git",
          ["diff", "HEAD~1", "HEAD", "--", item.file_path],
          { cwd: repoDir, timeout: 10000 }
        );
        unified_diff = diffResult.stdout;
      } catch {
        // diff may fail if file doesn't exist in one of the commits
        unified_diff = "";
      }
    } catch {
      // If git commands fail entirely, return empty diff
      return c.json({
        file_path: item.file_path,
        diff_type: item.diff_type,
        before: "",
        after: "",
        unified_diff: "",
      });
    }

    return c.json({
      file_path: item.file_path,
      diff_type: item.diff_type,
      before,
      after,
      unified_diff,
    });
  }
);

// PATCH /hub/projects/:slug/reviews/:id/items/:itemId — update item status and optional comment
reviews.patch(
  "/hub/projects/:slug/reviews/:id/items/:itemId",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const itemId = c.req.param("itemId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const review = await loadReview(slug, id);
    if (!review) return c.json({ error: "Review not found" }, 404);

    const item = review.items.find((i) => i.id === itemId);
    if (!item) return c.json({ error: "Review item not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = UpdateReviewItemBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    item.status = parsed.data.status;
    if (parsed.data.comment !== undefined) {
      item.comment = parsed.data.comment;
    }

    review.updated_at = new Date().toISOString();
    await saveReview(slug, review);

    return c.json(item);
  }
);

export { reviews };
