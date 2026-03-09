import { z } from "zod";

export const AutonomyLevelEnum = z.enum([
  "full_auto",
  "auto_with_review",
  "approval_required",
  "manual_only",
]);

export type AutonomyLevel = z.infer<typeof AutonomyLevelEnum>;

export const EscalationActionEnum = z.enum([
  "notify",
  "block",
  "fallback_manual",
]);

export type EscalationAction = z.infer<typeof EscalationActionEnum>;

export const PipelinePhaseEnum = z.enum([
  "brainstorming",
  "specs",
  "prps",
  "implementation",
  "review",
  "merge",
]);

export type PipelinePhase = z.infer<typeof PipelinePhaseEnum>;

export const PhaseAutonomyConfigSchema = z.object({
  phase: PipelinePhaseEnum,
  autonomy_level: AutonomyLevelEnum,
  confidence_threshold: z.number().min(0.5).max(1.0),
  require_sign_off: z.boolean(),
  max_auto_retries: z.number().int().min(0).max(5),
  escalation_action: EscalationActionEnum,
  updated_at: z.string().datetime(),
});

export type PhaseAutonomyConfig = z.infer<typeof PhaseAutonomyConfigSchema>;

export const PatchPhaseAutonomyBody = z.object({
  phase: PipelinePhaseEnum,
  autonomy_level: AutonomyLevelEnum.optional(),
  confidence_threshold: z.number().min(0.5).max(1.0).optional(),
  require_sign_off: z.boolean().optional(),
  max_auto_retries: z.number().int().min(0).max(5).optional(),
  escalation_action: EscalationActionEnum.optional(),
});

export type PatchPhaseAutonomyBody = z.infer<typeof PatchPhaseAutonomyBody>;

export const PHASE_DEFAULTS: Record<PipelinePhase, Omit<PhaseAutonomyConfig, "updated_at">> = {
  brainstorming: {
    phase: "brainstorming",
    autonomy_level: "full_auto",
    confidence_threshold: 0.70,
    require_sign_off: false,
    max_auto_retries: 3,
    escalation_action: "notify",
  },
  specs: {
    phase: "specs",
    autonomy_level: "auto_with_review",
    confidence_threshold: 0.85,
    require_sign_off: false,
    max_auto_retries: 2,
    escalation_action: "notify",
  },
  prps: {
    phase: "prps",
    autonomy_level: "approval_required",
    confidence_threshold: 0.85,
    require_sign_off: true,
    max_auto_retries: 1,
    escalation_action: "block",
  },
  implementation: {
    phase: "implementation",
    autonomy_level: "auto_with_review",
    confidence_threshold: 0.85,
    require_sign_off: false,
    max_auto_retries: 2,
    escalation_action: "notify",
  },
  review: {
    phase: "review",
    autonomy_level: "full_auto",
    confidence_threshold: 0.70,
    require_sign_off: false,
    max_auto_retries: 3,
    escalation_action: "notify",
  },
  merge: {
    phase: "merge",
    autonomy_level: "approval_required",
    confidence_threshold: 0.90,
    require_sign_off: true,
    max_auto_retries: 0,
    escalation_action: "block",
  },
};

export const ALL_PHASES: PipelinePhase[] = [
  "brainstorming",
  "specs",
  "prps",
  "implementation",
  "review",
  "merge",
];
