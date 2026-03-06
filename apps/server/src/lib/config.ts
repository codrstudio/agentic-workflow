import path from "node:path";

const DATA_DIR = process.env.ARC_DATA_DIR || path.join(process.cwd(), "data");
const WORKSPACES_DIR =
  process.env.ARC_WORKSPACES_DIR ||
  path.join(process.cwd(), "context", "workspaces");

export const config = {
  dataDir: DATA_DIR,
  projectsDir: path.join(DATA_DIR, "projects"),
  workspacesDir: WORKSPACES_DIR,
} as const;
