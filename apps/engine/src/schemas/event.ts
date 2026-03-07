import { z } from 'zod';

export const EngineEventTypeSchema = z.enum([
  'workflow:start',
  'workflow:step:start',
  'workflow:step:end',
  'workflow:end',
  'loop:start',
  'loop:iteration',
  'loop:end',
  'feature:start',
  'feature:pass',
  'feature:fail',
  'feature:skip',
  'agent:spawn',
  'agent:output',
  'agent:exit',
  'gutter:retry',
  'gutter:rollback',
  'gutter:skip',
  'workflow:chain',
  'workflow:spawn',
  'workflow:resume',
  'queue:received',
  'queue:processing',
  'queue:done',
]);

export const EngineEventSchema = z.object({
  type: EngineEventTypeSchema,
  timestamp: z.string(),
  data: z.record(z.unknown()),
});

export type EngineEventType = z.infer<typeof EngineEventTypeSchema>;
export type EngineEvent = z.infer<typeof EngineEventSchema>;
