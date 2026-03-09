import { z } from "zod";
import { PipelinePhaseEnum } from "./phase-autonomy.js";

export const DelegationEventTypeEnum = z.enum([
  "auto_executed",
  "review_requested",
  "approval_granted",
  "approval_denied",
  "escalated",
  "sign_off_completed",
]);

export type DelegationEventType = z.infer<typeof DelegationEventTypeEnum>;

export const DelegationEventSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  phase: PipelinePhaseEnum,
  event_type: DelegationEventTypeEnum,
  agent_confidence: z.number().min(0).max(1),
  details: z.string().optional(),
  created_at: z.string().datetime(),
});

export type DelegationEvent = z.infer<typeof DelegationEventSchema>;

export const CreateDelegationEventBody = z.object({
  phase: PipelinePhaseEnum,
  event_type: DelegationEventTypeEnum,
  agent_confidence: z.number().min(0).max(1),
  details: z.string().optional(),
});

export type CreateDelegationEventBody = z.infer<typeof CreateDelegationEventBody>;
