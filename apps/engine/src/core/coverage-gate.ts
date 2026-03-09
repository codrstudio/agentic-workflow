import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CoverageGateConfig {
  enabled: boolean;
  coverage_threshold_pct: number;
  coverage_tool: 'vitest' | 'jest' | 'c8' | 'custom';
  custom_command?: string;
  report_dir: string;
  fail_on_uncovered_files: boolean;
}

export interface CoverageResult {
  lines_pct: number;
  branches_pct: number;
  functions_pct: number;
  statements_pct: number;
  overall_pct: number;
  threshold_pct: number;
  passed: boolean;
  uncovered_files: string[];
  tool_used: string;
  stdout_preview: string | null;
  duration_ms: number;
}

const TOOL_COMMANDS: Record<string, string> = {
  vitest: 'npx vitest run --coverage --reporter=json',
  jest: 'npx jest --coverage --coverageReporters=json-summary',
  c8: 'npx c8 --reporter=json-summary npm test',
};

function buildCommand(config: CoverageGateConfig): string {
  if (config.coverage_tool === 'custom' && config.custom_command) {
    return config.custom_command;
  }
  return TOOL_COMMANDS[config.coverage_tool] ?? TOOL_COMMANDS['vitest']!;
}

function parseCoverageSummary(raw: string): {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  uncoveredFiles: string[];
} {
  try {
    const data = JSON.parse(raw);
    // Standard coverage-summary format (vitest/jest/c8)
    const total = data.total ?? data;
    const lines = total.lines?.pct ?? total.lines?.percent ?? 0;
    const branches = total.branches?.pct ?? total.branches?.percent ?? 0;
    const functions = total.functions?.pct ?? total.functions?.percent ?? 0;
    const statements = total.statements?.pct ?? total.statements?.percent ?? 0;

    // Collect files with 0% coverage
    const uncoveredFiles: string[] = [];
    for (const [filePath, fileCov] of Object.entries(data)) {
      if (filePath === 'total') continue;
      const fc = fileCov as Record<string, { pct?: number; percent?: number }>;
      const filePct =
        ((fc.lines?.pct ?? fc.lines?.percent ?? 0) +
          (fc.branches?.pct ?? fc.branches?.percent ?? 0) +
          (fc.functions?.pct ?? fc.functions?.percent ?? 0) +
          (fc.statements?.pct ?? fc.statements?.percent ?? 0)) /
        4;
      if (filePct === 0) {
        uncoveredFiles.push(filePath);
      }
    }

    return { lines, branches, functions, statements, uncoveredFiles };
  } catch {
    return { lines: 0, branches: 0, functions: 0, statements: 0, uncoveredFiles: [] };
  }
}

function execCommand(
  command: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        stdout: typeof stdout === 'string' ? stdout : '',
        stderr: typeof stderr === 'string' ? stderr : '',
        exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0,
      });
    });
  });
}

export async function runCoverageGate(
  config: CoverageGateConfig,
  worktreeDir: string,
): Promise<CoverageResult> {
  const command = buildCommand(config);
  const startMs = Date.now();

  const { stdout, stderr } = await execCommand(command, worktreeDir);
  const duration_ms = Date.now() - startMs;

  // Try to read coverage-summary.json from report_dir
  let summaryRaw = '';
  try {
    const summaryPath = join(worktreeDir, config.report_dir, 'coverage-summary.json');
    summaryRaw = await readFile(summaryPath, 'utf-8');
  } catch {
    // Fall back to parsing stdout for JSON
    const jsonMatch = stdout.match(/\{[\s\S]*"total"[\s\S]*\}/);
    if (jsonMatch) {
      summaryRaw = jsonMatch[0];
    }
  }

  const parsed = parseCoverageSummary(summaryRaw);
  const overall_pct =
    (parsed.lines + parsed.branches + parsed.functions + parsed.statements) / 4;
  const passed = overall_pct >= config.coverage_threshold_pct;

  const rawOutput = stdout + (stderr ? `\n${stderr}` : '');
  const stdout_preview = rawOutput.length > 1000 ? rawOutput.slice(0, 1000) : rawOutput || null;

  return {
    lines_pct: parsed.lines,
    branches_pct: parsed.branches,
    functions_pct: parsed.functions,
    statements_pct: parsed.statements,
    overall_pct,
    threshold_pct: config.coverage_threshold_pct,
    passed,
    uncovered_files: parsed.uncoveredFiles,
    tool_used: config.coverage_tool,
    stdout_preview,
    duration_ms,
  };
}

export function formatCoverageFailureContext(result: CoverageResult): string {
  let msg = `Feature falhou no test coverage gate (${result.overall_pct.toFixed(1)}% < ${result.threshold_pct}%).`;
  if (result.uncovered_files.length > 0) {
    msg += ` Arquivos sem cobertura: [${result.uncovered_files.join(', ')}]. Adicione testes para esses arquivos.`;
  }
  return msg;
}
