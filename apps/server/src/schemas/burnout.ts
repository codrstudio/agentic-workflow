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

export const WorkGuardrailsSchema = z.object({
  session_duration_limit: z.number().int().min(1).default(120),
  daily_active_limit: z.number().int().min(1).default(480),
  break_reminder_interval: z.number().int().min(1).default(45),
  late_hour_threshold: z.number().int().min(0).max(23).default(22),
  weekend_alerts_enabled: z.boolean().default(true),
  context_switch_warning_threshold: z.number().int().min(1).default(5),
});

export type WorkGuardrails = z.infer<typeof WorkGuardrailsSchema>;

export const GUARDRAILS_DEFAULTS: WorkGuardrails = {
  session_duration_limit: 120,
  daily_active_limit: 480,
  break_reminder_interval: 45,
  late_hour_threshold: 22,
  weekend_alerts_enabled: true,
  context_switch_warning_threshold: 5,
};

export const PatchGuardrailsBody = WorkGuardrailsSchema.partial();
