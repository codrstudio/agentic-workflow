import { z } from "zod";

export const PhaseEnum = z.enum([
  "brainstorming",
  "specs",
  "prps",
  "implementation",
  "review",
]);

export const SessionActivityLogSchema = z.object({
  session_id: z.string().uuid(),
  project_id: z.string().uuid(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  duration_minutes: z.number().min(0),
  phase: PhaseEnum,
  message_count: z.number().int().min(0),
  context_switches: z.number().int().min(0),
});

export type SessionActivityLog = z.infer<typeof SessionActivityLogSchema>;

export const CreateActivityLogBody = SessionActivityLogSchema;

export type CreateActivityLogBody = z.infer<typeof CreateActivityLogBody>;
