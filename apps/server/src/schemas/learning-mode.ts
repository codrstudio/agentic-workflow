import { z } from "zod";

export const LearningModeEnum = z.enum(["off", "light", "standard", "intensive"]);
export type LearningMode = z.infer<typeof LearningModeEnum>;

export const PHASE_TRANSITIONS = [
  "brainstorming→specs",
  "specs→prps",
  "prps→implementation",
  "implementation→review",
  "review→merge",
] as const;

export type PhaseTransition = (typeof PHASE_TRANSITIONS)[number];

export const PhaseTransitionsSchema = z.object({
  "brainstorming→specs": z.boolean(),
  "specs→prps": z.boolean(),
  "prps→implementation": z.boolean(),
  "implementation→review": z.boolean(),
  "review→merge": z.boolean(),
});

export type PhaseTransitions = z.infer<typeof PhaseTransitionsSchema>;

export const MODE_DEFAULTS: Record<LearningMode, PhaseTransitions> = {
  off: {
    "brainstorming→specs": false,
    "specs→prps": false,
    "prps→implementation": false,
    "implementation→review": false,
    "review→merge": false,
  },
  light: {
    "brainstorming→specs": false,
    "specs→prps": false,
    "prps→implementation": false,
    "implementation→review": false,
    "review→merge": true,
  },
  standard: {
    "brainstorming→specs": false,
    "specs→prps": true,
    "prps→implementation": false,
    "implementation→review": true,
    "review→merge": true,
  },
  intensive: {
    "brainstorming→specs": true,
    "specs→prps": true,
    "prps→implementation": true,
    "implementation→review": true,
    "review→merge": true,
  },
};

export const LearningModeConfigSchema = z.object({
  project_id: z.string().uuid(),
  mode: LearningModeEnum.default("standard"),
  phase_transitions: PhaseTransitionsSchema,
  updated_at: z.string().datetime(),
});

export type LearningModeConfig = z.infer<typeof LearningModeConfigSchema>;

export const PutLearningModeBody = z.object({
  mode: LearningModeEnum,
  phase_transitions: PhaseTransitionsSchema.optional(),
});

export type PutLearningModeBody = z.infer<typeof PutLearningModeBody>;

// ReflectionCheckpoint

export const CheckpointTypeEnum = z.enum([
  "comprehension_check",
  "design_rationale",
  "tradeoff_analysis",
  "review_summary",
]);

export const DepthClassificationEnum = z.enum(["shallow", "adequate", "deep"]);

export const ReflectionCheckpointSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  phase_transition: z.string(),
  checkpoint_type: CheckpointTypeEnum,
  questions: z.array(z.string()),
  developer_response: z.string().nullable().default(null),
  ai_evaluation: z.string().nullable().default(null),
  depth_classification: DepthClassificationEnum.nullable().default(null),
  skipped: z.boolean().default(false),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
});

export type ReflectionCheckpoint = z.infer<typeof ReflectionCheckpointSchema>;

export const CreateReflectionBody = z.object({
  phase_transition: z.string(),
  checkpoint_type: CheckpointTypeEnum,
  questions: z.array(z.string()).min(1),
  developer_response: z.string().nullable().optional(),
  ai_evaluation: z.string().nullable().optional(),
  depth_classification: DepthClassificationEnum.nullable().optional(),
  skipped: z.boolean().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

export type CreateReflectionBody = z.infer<typeof CreateReflectionBody>;

export const PatchReflectionBody = z.object({
  developer_response: z.string().nullable().optional(),
  ai_evaluation: z.string().nullable().optional(),
  depth_classification: DepthClassificationEnum.nullable().optional(),
  skipped: z.boolean().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

export type PatchReflectionBody = z.infer<typeof PatchReflectionBody>;
