import { z } from "zod";

// --- PhaseModelConfig ---

export const StepModelOverrideSchema = z.object({
  model: z.string(),
  model_fallback: z.string().optional(),
});

export const PhaseModelConfigSchema = z.object({
  project_id: z.string(),
  workflow: z.string(),
  step_overrides: z.record(z.string(), StepModelOverrideSchema).default({}),
  updated_at: z.string().datetime(),
});

export const PatchPhaseModelConfigBody = z.object({
  step_overrides: z.record(z.string(), StepModelOverrideSchema).optional(),
});

export type PhaseModelConfig = z.infer<typeof PhaseModelConfigSchema>;
export type PatchPhaseModelConfigBodyType = z.infer<typeof PatchPhaseModelConfigBody>;

// --- ModelOutputAttribution ---

export const ModelOutputAttributionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  artifact_id: z.string().uuid().nullable().default(null),
  feature_id: z.string().nullable().default(null),
  phase: z.string(),
  step_name: z.string(),
  model_used: z.string(),
  spawn_dir: z.string().nullable().default(null),
  recorded_at: z.string().datetime(),
});

export const CreateModelOutputAttributionBody = z.object({
  artifact_id: z.string().uuid().nullable().optional(),
  feature_id: z.string().nullable().optional(),
  phase: z.string(),
  step_name: z.string(),
  model_used: z.string(),
  spawn_dir: z.string().nullable().optional(),
});

export type ModelOutputAttribution = z.infer<typeof ModelOutputAttributionSchema>;
export type CreateModelOutputAttributionBodyType = z.infer<typeof CreateModelOutputAttributionBody>;

// --- Model Catalog ---

export const ModelTierEnum = z.enum(["fast", "balanced", "powerful"]);
export const CostTierEnum = z.enum(["low", "medium", "high"]);

export const ModelCatalogEntrySchema = z.object({
  id: z.string(),
  display_name: z.string(),
  tier: ModelTierEnum,
  cost_tier: CostTierEnum,
  description: z.string(),
});

export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntrySchema>;

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "claude-haiku-4-5",
    display_name: "Claude Haiku 4.5",
    tier: "fast",
    cost_tier: "low",
    description: "Fast, cost-effective model for simple tasks like brainstorming, merge conflict resolution, and quick iterations.",
  },
  {
    id: "claude-sonnet-4-6",
    display_name: "Claude Sonnet 4.6",
    tier: "balanced",
    cost_tier: "medium",
    description: "Balanced model offering strong quality for specs, PRPs, implementation, and code review.",
  },
  {
    id: "claude-opus-4-6",
    display_name: "Claude Opus 4.6",
    tier: "powerful",
    cost_tier: "high",
    description: "Most powerful model for complex architectural decisions, deep analysis, and critical code generation.",
  },
];
