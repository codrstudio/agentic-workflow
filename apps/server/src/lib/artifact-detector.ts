import { randomUUID } from "node:crypto";

export interface DetectedArtifact {
  name: string;
  type: "code" | "document";
  content: string;
  language?: string;
}

const CODE_BLOCK_RE = /```(\w+)?\n([\s\S]*?)```/g;
const ARTIFACT_MARKER_RE =
  /<!--\s*artifact:\s*(.+?)\s*-->\n([\s\S]*?)<!--\s*\/artifact\s*-->/g;

const MIN_CODE_LINES = 10;

function inferArtifactName(language: string | undefined, index: number): string {
  const lang = language?.toLowerCase() ?? "code";
  const extMap: Record<string, string> = {
    typescript: "snippet.ts",
    ts: "snippet.ts",
    javascript: "snippet.js",
    js: "snippet.js",
    tsx: "snippet.tsx",
    jsx: "snippet.jsx",
    python: "snippet.py",
    py: "snippet.py",
    rust: "snippet.rs",
    go: "snippet.go",
    java: "snippet.java",
    css: "snippet.css",
    html: "snippet.html",
    json: "data.json",
    yaml: "config.yaml",
    yml: "config.yaml",
    sql: "query.sql",
    bash: "script.sh",
    sh: "script.sh",
  };
  const base = extMap[lang] ?? `snippet-${lang}.txt`;
  return index === 0 ? base : base.replace(/(\.\w+)$/, `-${index + 1}$1`);
}

export function extractArtifacts(content: string): DetectedArtifact[] {
  const artifacts: DetectedArtifact[] = [];

  // 1. Detect explicit artifact markers: <!-- artifact:name --> ... <!-- /artifact -->
  let match: RegExpExecArray | null;
  const markerRanges: Array<[number, number]> = [];

  ARTIFACT_MARKER_RE.lastIndex = 0;
  while ((match = ARTIFACT_MARKER_RE.exec(content)) !== null) {
    const name = match[1]!.trim();
    const body = match[2]!.trim();
    if (body.length > 0) {
      artifacts.push({ name, type: "document", content: body });
      markerRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // 2. Detect code blocks with >10 lines (skip those inside artifact markers)
  CODE_BLOCK_RE.lastIndex = 0;
  let codeIndex = 0;
  while ((match = CODE_BLOCK_RE.exec(content)) !== null) {
    const blockStart = match.index;
    const blockEnd = blockStart + match[0].length;

    // Skip if inside an artifact marker
    const insideMarker = markerRanges.some(
      ([s, e]) => blockStart >= s && blockEnd <= e,
    );
    if (insideMarker) continue;

    const language = match[1];
    const code = match[2]!;
    const lineCount = code.split("\n").filter((l) => l.trim().length > 0).length;

    if (lineCount > MIN_CODE_LINES) {
      artifacts.push({
        name: inferArtifactName(language, codeIndex),
        type: language === "json" ? "code" : "code",
        content: code.trimEnd(),
        language,
      });
      codeIndex++;
    }
  }

  return artifacts;
}
