import path from "node:path";

const DATA_DIR = process.env.ARC_DATA_DIR || path.join(process.cwd(), "data");

export const config = {
  dataDir: DATA_DIR,
  projectsDir: path.join(DATA_DIR, "projects"),
} as const;
