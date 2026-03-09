export interface ContributionQualityGateConfig {
  enabled: boolean;
  min_quality_score: number;
  auto_reject_below: number;
  check_ai_patterns: boolean;
  check_test_coverage: boolean;
  check_code_duplication: boolean;
  check_security_patterns: boolean;
  check_architectural_conformance: boolean;
}

export interface QualityScores {
  originality: number;
  test_coverage: number;
  code_duplication: number;
  security: number;
  architectural_conformance: number;
}

export interface QualityFlag {
  type: string;
  severity: string;
  message: string;
  file?: string;
  line?: number;
}

const WEIGHTS: Record<keyof QualityScores, number> = {
  originality: 0.20,
  test_coverage: 0.30,
  code_duplication: 0.15,
  security: 0.25,
  architectural_conformance: 0.10,
};

export function calculateOverallScore(scores: QualityScores): number {
  return (
    scores.originality * WEIGHTS.originality +
    scores.test_coverage * WEIGHTS.test_coverage +
    scores.code_duplication * WEIGHTS.code_duplication +
    scores.security * WEIGHTS.security +
    scores.architectural_conformance * WEIGHTS.architectural_conformance
  );
}

export function formatQualityFailureContext(
  scores: Record<string, number>,
  overallScore: number,
  config: ContributionQualityGateConfig,
  flags: QualityFlag[],
): string {
  let msg = `Feature auto-rejected by contribution quality gate (${overallScore.toFixed(1)} < ${config.auto_reject_below}).`;
  msg += ` Scores: originality=${scores['originality'] ?? 0}`;
  msg += `, test_coverage=${scores['test_coverage'] ?? 0}`;
  msg += `, code_duplication=${scores['code_duplication'] ?? 0}`;
  msg += `, security=${scores['security'] ?? 0}`;
  msg += `, acr=${scores['architectural_conformance'] ?? 0}.`;

  if (flags.length > 0) {
    msg += ' Flags:';
    for (const flag of flags) {
      msg += ` [${flag.severity.toUpperCase()}] ${flag.type}: ${flag.message}`;
      if (flag.file) msg += ` (${flag.file}:${flag.line ?? '?'})`;
      msg += ';';
    }
  }

  return msg;
}

export function formatQualityRetryContext(
  scores: Record<string, number>,
  overallScore: number,
  config: ContributionQualityGateConfig,
  flags: QualityFlag[],
): string {
  let msg = `Feature falhou no contribution quality gate (${overallScore.toFixed(1)} < ${config.min_quality_score}).`;
  msg += ' Dimensoes abaixo do threshold:';

  const dimensions = ['originality', 'test_coverage', 'code_duplication', 'security', 'architectural_conformance'] as const;
  for (const dim of dimensions) {
    const score = scores[dim] ?? 0;
    if (score < config.min_quality_score) {
      msg += ` ${dim}=${score}`;
    }
  }

  if (flags.length > 0) {
    msg += `. Flags: ${flags.map((f) => `${f.type} (${f.severity})`).join(', ')}`;
  }

  return msg;
}
