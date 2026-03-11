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

const base = z.object({
  timestamp: z.string(),
  project_slug: z.string().optional(),
  wave_number: z.number().int().optional(),
});

export const EngineEventSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('agent:spawn'),
    data: z
      .object({
        task: z.string(),
        agent: z.string(),
        mode: z.string().optional(),
        feature_id: z.string().optional(),
        spawn_dir: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('agent:output'),
    data: z
      .object({
        task: z.string(),
        agent: z.string(),
        feature_id: z.string().optional(),
        content_type: z.enum(['json', 'text']),
        preview: z.string(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('agent:exit'),
    data: z
      .object({
        task: z.string(),
        agent: z.string().optional(),
        exit_code: z.number(),
        duration_ms: z.number().optional(),
        timed_out: z.boolean(),
        output_preview: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('feature:start'),
    data: z
      .object({
        feature_id: z.string(),
        feature_name: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('feature:pass'),
    data: z
      .object({
        feature_id: z.string(),
        feature_name: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('feature:fail'),
    data: z
      .object({
        feature_id: z.string(),
        feature_name: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('feature:skip'),
    data: z
      .object({
        feature_id: z.string(),
        feature_name: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:start'),
    data: z
      .object({
        workflow: z.string(),
        wave: z.number().optional(),
        steps: z.number().optional(),
        reason: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:end'),
    data: z
      .object({
        workflow: z.string().optional(),
        wave: z.number().optional(),
        steps: z.number().optional(),
        reason: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:step:start'),
    data: z
      .object({
        step: z.string(),
        type: z.string(),
        index: z.number(),
        total: z.number().optional(),
        result: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:step:end'),
    data: z
      .object({
        step: z.string(),
        type: z.string(),
        index: z.number(),
        total: z.number().optional(),
        result: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('loop:start'),
    data: z
      .object({
        total: z.number().optional(),
        iteration: z.number().optional(),
        reason: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('loop:iteration'),
    data: z
      .object({
        total: z.number().optional(),
        iteration: z.number().optional(),
        reason: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('loop:end'),
    data: z
      .object({
        total: z.number().optional(),
        iteration: z.number().optional(),
        reason: z.string().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('gutter:retry'),
    data: z
      .object({
        feature_id: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('gutter:rollback'),
    data: z
      .object({
        feature_id: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('gutter:skip'),
    data: z
      .object({
        feature_id: z.string(),
        retries: z.number().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:chain'),
    data: z.object({ from: z.string(), to: z.string() }).passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:spawn'),
    data: z.object({ from: z.string(), to: z.string() }).passthrough(),
  }),
  base.extend({
    type: z.literal('workflow:resume'),
    data: z.object({ index: z.number(), step: z.string() }).passthrough(),
  }),
  base.extend({
    type: z.literal('queue:received'),
    data: z
      .object({
        message: z.string().optional(),
        count: z.number().optional(),
        exit_code: z.number().optional(),
        timed_out: z.boolean().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('queue:processing'),
    data: z
      .object({
        message: z.string().optional(),
        count: z.number().optional(),
        exit_code: z.number().optional(),
        timed_out: z.boolean().optional(),
      })
      .passthrough(),
  }),
  base.extend({
    type: z.literal('queue:done'),
    data: z
      .object({
        message: z.string().optional(),
        count: z.number().optional(),
        exit_code: z.number().optional(),
        timed_out: z.boolean().optional(),
      })
      .passthrough(),
  }),
]);

export type EngineEventType = z.infer<typeof EngineEventTypeSchema>;
export type EngineEvent = z.infer<typeof EngineEventSchema>;
