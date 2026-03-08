import { z } from "zod";

export const ExperienceLevelEnum = z.enum([
  "beginner",
  "junior",
  "mid",
  "senior",
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelEnum>;

export const LearningNoteSchema = z.object({
  phase: z.string(),
  note: z.string(),
  created_at: z.string().datetime(),
});
export type LearningNote = z.infer<typeof LearningNoteSchema>;

export const MentoringProfileSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  label: z.string().min(1),
  experience_level: ExperienceLevelEnum,
  explanations_enabled: z.boolean().default(true),
  guided_mode: z.boolean().default(true),
  challenge_mode: z.boolean().default(false),
  phases_completed: z.array(z.string()).default([]),
  learning_notes: z.array(LearningNoteSchema).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type MentoringProfile = z.infer<typeof MentoringProfileSchema>;

export const CreateMentoringProfileBody = z.object({
  label: z.string().min(1),
  experience_level: ExperienceLevelEnum,
  explanations_enabled: z.boolean().optional(),
  guided_mode: z.boolean().optional(),
  challenge_mode: z.boolean().optional(),
});
export type CreateMentoringProfileBody = z.infer<typeof CreateMentoringProfileBody>;

export const PatchMentoringProfileBody = z.object({
  label: z.string().min(1).optional(),
  experience_level: ExperienceLevelEnum.optional(),
  explanations_enabled: z.boolean().optional(),
  guided_mode: z.boolean().optional(),
  challenge_mode: z.boolean().optional(),
  add_learning_note: LearningNoteSchema.omit({ created_at: true }).optional(),
  add_phase_completed: z.string().optional(),
});
export type PatchMentoringProfileBody = z.infer<typeof PatchMentoringProfileBody>;
