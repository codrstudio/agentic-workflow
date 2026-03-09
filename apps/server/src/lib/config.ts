import path from "node:path";

const CONTEXT_DIR = process.env.CONTEXT_FOLDER
  ? path.resolve(process.cwd(), process.env.CONTEXT_FOLDER)
  : path.join(process.cwd(), "context");

export const config = {
  contextDir: CONTEXT_DIR,
  projectsDir: path.join(CONTEXT_DIR, "projects"),
  workspacesDir: path.join(CONTEXT_DIR, "workspaces"),
  serverPort: Number(process.env.SERVER_PORT) || 2101,
} as const;
