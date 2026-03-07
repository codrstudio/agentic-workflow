import { z } from "zod";

export const QualityFactorsSchema = z.object({
  first_pass_accepted: z.boolean().default(false),
  review_issues_count: z.number().int().min(0).default(0),
  rework_required: z.boolean().default(false),
  defects_introduced: z.number().int().min(0).default(0),
});

export type QualityFactors = z.infer<typeof QualityFactorsSchema>;

export const AgentEvaluationSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  agent_profile: z.string(),
  agent_model: z.string(),
  task_type: z.string(),
  wave_number: z.number().int().min(1),
  step_name: z.string(),
  feature_id: z.string().optional(),
  attempt_number: z.number().int().min(1).default(1),
  exit_code: z.number().int(),
  success: z.boolean(),
  duration_seconds: z.number().min(0),
  tokens_used: z.number().int().min(0).default(0),
  cost_usd: z.number().min(0).default(0),
  quality_score: z.number().min(0).max(100).optional(),
  quality_factors: QualityFactorsSchema.optional(),
  spawn_json_path: z.string().optional(),
  created_at: z.string().datetime(),
});

export type AgentEvaluation = z.infer<typeof AgentEvaluationSchema>;

export const CreateAgentEvaluationBody = z.object({
  agent_profile: z.string(),
  agent_model: z.string(),
  task_type: z.string(),
  wave_number: z.number().int().min(1),
  step_name: z.string(),
  feature_id: z.string().optional(),
  attempt_number: z.number().int().min(1).optional(),
  exit_code: z.number().int(),
  success: z.boolean(),
  duration_seconds: z.number().min(0),
  tokens_used: z.number().int().min(0).optional(),
  cost_usd: z.number().min(0).optional(),
  quality_score: z.number().min(0).max(100).optional(),
  quality_factors: QualityFactorsSchema.optional(),
  spawn_json_path: z.string().optional(),
});

export type CreateAgentEvaluationBody = z.infer<typeof CreateAgentEvaluationBody>;

export const PatchAgentEvaluationBody = z.object({
  quality_score: z.number().min(0).max(100).optional(),
  quality_factors: QualityFactorsSchema.optional(),
});

export type PatchAgentEvaluationBody = z.infer<typeof PatchAgentEvaluationBody>;
