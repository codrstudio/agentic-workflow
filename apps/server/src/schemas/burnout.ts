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

export const RiskLevelEnum = z.enum(["low", "moderate", "high", "critical"]);

export const RiskFactorSchema = z.object({
  factor: z.string(),
  description: z.string(),
  current_value: z.number(),
  threshold: z.number(),
  triggered: z.boolean(),
});

export type RiskFactor = z.infer<typeof RiskFactorSchema>;

export const BurnoutIndicatorsSchema = z.object({
  project_id: z.string(),
  computed_at: z.string().datetime(),
  period_days: z.number().int(),

  // Intensity metrics
  avg_session_duration_minutes: z.number(),
  total_active_minutes_period: z.number(),
  sessions_count_period: z.number().int(),
  avg_messages_per_session: z.number(),

  // Pattern metrics
  longest_streak_days: z.number().int(),
  late_sessions_count: z.number().int(),
  weekend_sessions_count: z.number().int(),
  avg_context_switches_per_session: z.number(),

  // Verification metrics
  review_to_generation_ratio: z.number(),
  verification_minutes_period: z.number(),

  // Risk
  risk_level: RiskLevelEnum,
  risk_factors: z.array(RiskFactorSchema),
});

export type BurnoutIndicators = z.infer<typeof BurnoutIndicatorsSchema>;
