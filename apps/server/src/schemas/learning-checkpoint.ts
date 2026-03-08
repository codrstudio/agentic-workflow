import { z } from "zod";

export const LearningCheckpointQuestionSchema = z.object({
  question: z.string(),
  developer_answer: z.string().nullable().default(null),
  ai_evaluation: z.string().nullable().default(null),
  passed: z.boolean().nullable().default(null),
});
export type LearningCheckpointQuestion = z.infer<typeof LearningCheckpointQuestionSchema>;

export const LearningCheckpointSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  phase: z.string(),
  learning_objectives: z.array(z.string()),
  questions: z.array(LearningCheckpointQuestionSchema),
  phase_explanation: z.string(),
  key_decisions: z.array(z.string()),
  completed: z.boolean().default(false),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
});
export type LearningCheckpoint = z.infer<typeof LearningCheckpointSchema>;

export const GenerateCheckpointBody = z.object({
  phase: z.string().min(1),
});
export type GenerateCheckpointBody = z.infer<typeof GenerateCheckpointBody>;

export const SubmitAnswerSchema = z.object({
  question_index: z.number().int().min(0),
  answer: z.string(),
});

export const SubmitCheckpointBody = z.object({
  answers: z.array(SubmitAnswerSchema).min(1),
});
export type SubmitCheckpointBody = z.infer<typeof SubmitCheckpointBody>;
