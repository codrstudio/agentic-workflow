import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { readJSON } from "./fs-utils.js";

// --- Types ---

export type CheckType =
  | "file_exists"
  | "section_exists"
  | "min_count"
  | "json_field_present"
  | "cross_reference";

export type GateTransition =
  | "brainstorming_to_specs"
  | "specs_to_prps"
  | "prps_to_features";

export const GATE_TRANSITIONS: GateTransition[] = [
  "brainstorming_to_specs",
  "specs_to_prps",
  "prps_to_features",
];

export interface CheckDefinition {
  id: string;
  description: string;
  check_type: CheckType;
  target: string;
  threshold?: number;
}

export interface CheckResult {
  id: string;
  description: string;
  check_type: CheckType;
  target: string;
  threshold?: number;
  passed: boolean;
  details?: string;
}

export interface GateEvaluationResult {
  transition: GateTransition;
  status: "passing" | "failing";
  checks: CheckResult[];
  evaluated_at: string;
}

// --- Predefined checks per transition (from spec S-014 section 3) ---

const BRAINSTORMING_TO_SPECS_CHECKS: CheckDefinition[] = [
  {
    id: "BS001",
    description: "brainstorming.md existe",
    check_type: "file_exists",
    target: "1-brainstorming/brainstorming.md",
  },
  {
    id: "BS002",
    description: "ranking.json existe",
    check_type: "file_exists",
    target: "1-brainstorming/ranking.json",
  },
  {
    id: "BS003",
    description: 'Decision "go" no ranking',
    check_type: "json_field_present",
    target: "1-brainstorming/ranking.json -> decision",
  },
  {
    id: "BS004",
    description: 'Secao "Dores" no brainstorming',
    check_type: "section_exists",
    target: '1-brainstorming/brainstorming.md -> "## 1. Dores"',
  },
  {
    id: "BS005",
    description: 'Secao "Ganhos" no brainstorming',
    check_type: "section_exists",
    target: '1-brainstorming/brainstorming.md -> "## 2. Ganhos"',
  },
  {
    id: "BS006",
    description: "Minimo 5 discoveries no ranking",
    check_type: "min_count",
    target: "1-brainstorming/ranking.json -> discoveries",
    threshold: 5,
  },
];

const SPECS_TO_PRPS_CHECKS: CheckDefinition[] = [
  {
    id: "SP001",
    description: "Minimo 1 spec na pasta",
    check_type: "min_count",
    target: "2-specs/*.md",
    threshold: 1,
  },
  {
    id: "SP002",
    description: 'Cada spec tem "Objetivo"',
    check_type: "section_exists",
    target: '2-specs/*.md -> "## 1. Objetivo"',
  },
  {
    id: "SP003",
    description: 'Cada spec tem "Criterios de Aceite"',
    check_type: "section_exists",
    target: '2-specs/*.md -> "Criterios de Aceite"',
  },
  {
    id: "SP004",
    description: 'Cada spec tem "Rastreabilidade"',
    check_type: "section_exists",
    target: '2-specs/*.md -> "Rastreabilidade"',
  },
  {
    id: "SP005",
    description: "Specs referenciam discoveries do ranking",
    check_type: "cross_reference",
    target: "2-specs/*.md -> 1-brainstorming/ranking.json discoveries",
  },
];

const PRPS_TO_FEATURES_CHECKS: CheckDefinition[] = [
  {
    id: "PF001",
    description: "Minimo 1 PRP na pasta",
    check_type: "min_count",
    target: "3-prps/*.md",
    threshold: 1,
  },
  {
    id: "PF002",
    description: 'Cada PRP tem "Features"',
    check_type: "section_exists",
    target: '3-prps/*.md -> "Features"',
  },
  {
    id: "PF003",
    description: "PRPs referenciam specs",
    check_type: "cross_reference",
    target: "3-prps/*.md -> 2-specs/*.md",
  },
  {
    id: "PF004",
    description: 'Cada PRP tem "Criterios de Aceite"',
    check_type: "section_exists",
    target: '3-prps/*.md -> "Criterios de Aceite"',
  },
];

export const CHECKS_BY_TRANSITION: Record<GateTransition, CheckDefinition[]> = {
  brainstorming_to_specs: BRAINSTORMING_TO_SPECS_CHECKS,
  specs_to_prps: SPECS_TO_PRPS_CHECKS,
  prps_to_features: PRPS_TO_FEATURES_CHECKS,
};

// --- Check executors ---

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listMdFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}

/**
 * check_type: file_exists
 * target: relative path from sprint dir (e.g. "1-brainstorming/brainstorming.md")
 */
async function executeFileExists(
  sprintDir: string,
  check: CheckDefinition,
): Promise<CheckResult> {
  const filePath = path.join(sprintDir, check.target);
  const exists = await fileExists(filePath);
  return {
    ...check,
    passed: exists,
    details: exists ? `Arquivo encontrado: ${check.target}` : `Arquivo nao encontrado: ${check.target}`,
  };
}

/**
 * check_type: section_exists
 * target format: "path -> heading" or "path/*.md -> heading" (checks all matching files)
 */
async function executeSectionExists(
  sprintDir: string,
  check: CheckDefinition,
): Promise<CheckResult> {
  const [pathPart, headingPart] = check.target.split(" -> ");
  if (!pathPart || !headingPart) {
    return { ...check, passed: false, details: "Target format invalido" };
  }

  const heading = headingPart.replace(/^"|"$/g, ""); // strip quotes
  const headingRegex = new RegExp(`^#{1,6}\\s+.*${escapeRegex(heading.replace(/^#+\s*/, ""))}`, "mi");

  // If target uses glob pattern *.md, check all matching files
  if (pathPart.includes("*.md")) {
    const dir = path.join(sprintDir, pathPart.replace("/*.md", ""));
    const files = await listMdFiles(dir);

    if (files.length === 0) {
      return { ...check, passed: false, details: `Nenhum arquivo .md encontrado em ${pathPart.replace("/*.md", "")}` };
    }

    const missing: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      if (!headingRegex.test(content)) {
        missing.push(path.basename(file));
      }
    }

    if (missing.length === 0) {
      return { ...check, passed: true, details: `Secao "${heading}" encontrada em todos os ${files.length} arquivos` };
    }
    return {
      ...check,
      passed: false,
      details: `Secao "${heading}" ausente em: ${missing.join(", ")}`,
    };
  }

  // Single file check
  const filePath = path.join(sprintDir, pathPart);
  if (!(await fileExists(filePath))) {
    return { ...check, passed: false, details: `Arquivo nao encontrado: ${pathPart}` };
  }

  const content = await readFile(filePath, "utf-8");
  const found = headingRegex.test(content);
  return {
    ...check,
    passed: found,
    details: found
      ? `Secao "${heading}" encontrada em ${pathPart}`
      : `Secao "${heading}" nao encontrada em ${pathPart}`,
  };
}

/**
 * check_type: min_count
 * target format: "path/*.md" (count files) or "path.json -> field" (count array items)
 */
async function executeMinCount(
  sprintDir: string,
  check: CheckDefinition,
): Promise<CheckResult> {
  const threshold = check.threshold ?? 1;

  // JSON array field count: "path.json -> field"
  if (check.target.includes(" -> ")) {
    const [filePart, fieldPart] = check.target.split(" -> ");
    if (!filePart || !fieldPart) {
      return { ...check, passed: false, details: "Target format invalido" };
    }

    const filePath = path.join(sprintDir, filePart);
    try {
      const data = await readJSON<Record<string, unknown>>(filePath);
      const fieldValue = data[fieldPart];
      const count = Array.isArray(fieldValue) ? fieldValue.length : 0;
      const passed = count >= threshold;
      return {
        ...check,
        passed,
        details: passed
          ? `${count} items encontrados em ${fieldPart} (minimo: ${threshold})`
          : `Apenas ${count} items em ${fieldPart} (minimo: ${threshold})`,
      };
    } catch {
      return { ...check, passed: false, details: `Erro ao ler ${filePart}` };
    }
  }

  // File glob count: "path/*.md"
  if (check.target.includes("*.md")) {
    const dir = path.join(sprintDir, check.target.replace("/*.md", ""));
    const files = await listMdFiles(dir);
    const count = files.length;
    const passed = count >= threshold;
    return {
      ...check,
      passed,
      details: passed
        ? `${count} arquivos .md encontrados (minimo: ${threshold})`
        : `Apenas ${count} arquivos .md encontrados (minimo: ${threshold})`,
    };
  }

  return { ...check, passed: false, details: "Target format nao suportado para min_count" };
}

/**
 * check_type: json_field_present
 * target format: "path.json -> field"
 */
async function executeJsonFieldPresent(
  sprintDir: string,
  check: CheckDefinition,
): Promise<CheckResult> {
  const [filePart, fieldPart] = check.target.split(" -> ");
  if (!filePart || !fieldPart) {
    return { ...check, passed: false, details: "Target format invalido" };
  }

  const filePath = path.join(sprintDir, filePart);
  try {
    const data = await readJSON<Record<string, unknown>>(filePath);
    const value = data[fieldPart];
    const present = value !== undefined && value !== null && value !== "";
    return {
      ...check,
      passed: present,
      details: present
        ? `Campo "${fieldPart}" presente em ${filePart} (valor: ${JSON.stringify(value).slice(0, 50)})`
        : `Campo "${fieldPart}" ausente ou vazio em ${filePart}`,
    };
  } catch {
    return { ...check, passed: false, details: `Erro ao ler ${filePart}` };
  }
}

/**
 * check_type: cross_reference
 * target format: "source_path -> reference_path field"
 * Examples:
 *   "2-specs/*.md -> 1-brainstorming/ranking.json discoveries"
 *   "3-prps/*.md -> 2-specs/*.md"
 */
async function executeCrossReference(
  sprintDir: string,
  check: CheckDefinition,
): Promise<CheckResult> {
  const [sourcePart, refPart] = check.target.split(" -> ");
  if (!sourcePart || !refPart) {
    return { ...check, passed: false, details: "Target format invalido" };
  }

  // Get source files (the ones that should contain references)
  let sourceFiles: string[] = [];
  if (sourcePart.includes("*.md")) {
    const dir = path.join(sprintDir, sourcePart.replace("/*.md", ""));
    sourceFiles = await listMdFiles(dir);
  } else {
    const fp = path.join(sprintDir, sourcePart);
    if (await fileExists(fp)) sourceFiles = [fp];
  }

  if (sourceFiles.length === 0) {
    return { ...check, passed: false, details: `Nenhum arquivo source encontrado: ${sourcePart}` };
  }

  // Determine reference identifiers to look for
  let referenceIds: string[] = [];

  if (refPart.includes(".json")) {
    // Reference is a JSON file with a field containing identifiable items
    // e.g. "1-brainstorming/ranking.json discoveries"
    const parts = refPart.split(" ");
    const jsonPath = parts[0]!;
    const field = parts[1];

    try {
      const data = await readJSON<Record<string, unknown>>(
        path.join(sprintDir, jsonPath),
      );

      if (field) {
        const arr = data[field];
        if (Array.isArray(arr)) {
          // Extract IDs from discovery objects (e.g. D-001, G-001)
          referenceIds = arr
            .map((item: unknown) => {
              if (typeof item === "object" && item !== null && "id" in item) {
                return String((item as { id: unknown }).id);
              }
              return null;
            })
            .filter((id): id is string => id !== null);
        }
      }
    } catch {
      return { ...check, passed: false, details: `Erro ao ler ${jsonPath}` };
    }
  } else if (refPart.includes("*.md")) {
    // Reference is another set of markdown files
    // e.g. "2-specs/*.md" — check that source files reference spec identifiers (S-XXX) or filenames
    const refDir = path.join(sprintDir, refPart.replace("/*.md", ""));
    const refFiles = await listMdFiles(refDir);
    // Extract identifiers from filenames: S-011-xxx.md -> S-011, also just the filename
    referenceIds = refFiles.map((f) => {
      const base = path.basename(f, ".md");
      const match = base.match(/^(S-\d+|PRP-\d+)/i);
      return match ? match[1]! : base;
    });
  }

  if (referenceIds.length === 0) {
    return { ...check, passed: false, details: "Nenhuma referencia encontrada para validar" };
  }

  // Check that each source file references at least one reference ID
  const missing: string[] = [];
  for (const sourceFile of sourceFiles) {
    const content = await readFile(sourceFile, "utf-8");
    const hasRef = referenceIds.some((id) => content.includes(id));
    if (!hasRef) {
      missing.push(path.basename(sourceFile));
    }
  }

  if (missing.length === 0) {
    return {
      ...check,
      passed: true,
      details: `Todos os ${sourceFiles.length} arquivos referenciam artefatos corretamente`,
    };
  }

  return {
    ...check,
    passed: false,
    details: `Arquivos sem referencias cruzadas: ${missing.join(", ")}`,
  };
}

// --- Main evaluation function ---

const CHECK_EXECUTORS: Record<
  CheckType,
  (sprintDir: string, check: CheckDefinition) => Promise<CheckResult>
> = {
  file_exists: executeFileExists,
  section_exists: executeSectionExists,
  min_count: executeMinCount,
  json_field_present: executeJsonFieldPresent,
  cross_reference: executeCrossReference,
};

/**
 * Evaluate all checks for a given transition against a sprint directory.
 */
export async function evaluateGate(
  sprintDir: string,
  transition: GateTransition,
): Promise<GateEvaluationResult> {
  const checks = CHECKS_BY_TRANSITION[transition];
  const results: CheckResult[] = [];

  for (const check of checks) {
    const executor = CHECK_EXECUTORS[check.check_type];
    const result = await executor(sprintDir, check);
    results.push(result);
  }

  const allPassed = results.every((r) => r.passed);

  return {
    transition,
    status: allPassed ? "passing" : "failing",
    checks: results,
    evaluated_at: new Date().toISOString(),
  };
}

// --- Helpers ---

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
