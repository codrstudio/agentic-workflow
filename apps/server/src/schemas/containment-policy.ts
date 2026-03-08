import { z } from "zod";

export const ContainmentLevelEnum = z.enum([
  "unrestricted",
  "standard",
  "restricted",
  "isolated",
]);
export type ContainmentLevel = z.infer<typeof ContainmentLevelEnum>;

export const LEVEL_SEVERITY: Record<ContainmentLevel, number> = {
  unrestricted: 0,
  standard: 1,
  restricted: 2,
  isolated: 3,
};

export const AppliesToSchema = z.object({
  steps: z.array(z.string()).nullable().default(null),
  agents: z.array(z.string()).nullable().default(null),
});

export const ExecutionLimitsSchema = z.object({
  max_turns: z.number().int().positive().default(200),
  timeout_minutes: z.number().int().positive().default(30),
  max_output_tokens: z.number().int().positive().nullable().default(null),
});

export const PathRestrictionsSchema = z.object({
  allowed_paths: z.array(z.string()).default([]),
  blocked_paths: z.array(z.string()).default([]),
  read_only: z.array(z.string()).default([]),
});

export const ToolRestrictionsSchema = z.object({
  allowed_tools: z.array(z.string()).nullable().default(null),
  blocked_tools: z.array(z.string()).nullable().default(null),
});

export const OnTimeoutEnum = z.enum(["kill", "warn_and_extend", "save_and_kill"]);
export const OnDriftEnum = z.enum(["ignore", "warn", "intervene", "kill"]);

export const GraduatedResponseSchema = z.object({
  on_timeout: OnTimeoutEnum.default("kill"),
  on_drift: OnDriftEnum.default("warn"),
});

export const ContainmentPolicySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  level: ContainmentLevelEnum,
  applies_to: AppliesToSchema,
  execution_limits: ExecutionLimitsSchema,
  path_restrictions: PathRestrictionsSchema,
  tool_restrictions: ToolRestrictionsSchema,
  graduated_response: GraduatedResponseSchema,
  enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ContainmentPolicy = z.infer<typeof ContainmentPolicySchema>;

export const CreateContainmentPolicyBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  level: ContainmentLevelEnum,
  applies_to: z
    .object({
      steps: z.array(z.string()).nullable().optional(),
      agents: z.array(z.string()).nullable().optional(),
    })
    .optional(),
  execution_limits: z
    .object({
      max_turns: z.number().int().positive().optional(),
      timeout_minutes: z.number().int().positive().optional(),
      max_output_tokens: z.number().int().positive().nullable().optional(),
    })
    .optional(),
  path_restrictions: z
    .object({
      allowed_paths: z.array(z.string()).optional(),
      blocked_paths: z.array(z.string()).optional(),
      read_only: z.array(z.string()).optional(),
    })
    .optional(),
  tool_restrictions: z
    .object({
      allowed_tools: z.array(z.string()).nullable().optional(),
      blocked_tools: z.array(z.string()).nullable().optional(),
    })
    .optional(),
  graduated_response: z
    .object({
      on_timeout: OnTimeoutEnum.optional(),
      on_drift: OnDriftEnum.optional(),
    })
    .optional(),
  enabled: z.boolean().optional(),
});

export type CreateContainmentPolicyBody = z.infer<typeof CreateContainmentPolicyBody>;

export const PatchContainmentPolicyBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  level: ContainmentLevelEnum.optional(),
  applies_to: z
    .object({
      steps: z.array(z.string()).nullable().optional(),
      agents: z.array(z.string()).nullable().optional(),
    })
    .optional(),
  execution_limits: z
    .object({
      max_turns: z.number().int().positive().optional(),
      timeout_minutes: z.number().int().positive().optional(),
      max_output_tokens: z.number().int().positive().nullable().optional(),
    })
    .optional(),
  path_restrictions: z
    .object({
      allowed_paths: z.array(z.string()).optional(),
      blocked_paths: z.array(z.string()).optional(),
      read_only: z.array(z.string()).optional(),
    })
    .optional(),
  tool_restrictions: z
    .object({
      allowed_tools: z.array(z.string()).nullable().optional(),
      blocked_tools: z.array(z.string()).nullable().optional(),
    })
    .optional(),
  graduated_response: z
    .object({
      on_timeout: OnTimeoutEnum.optional(),
      on_drift: OnDriftEnum.optional(),
    })
    .optional(),
  enabled: z.boolean().optional(),
});

export type PatchContainmentPolicyBody = z.infer<typeof PatchContainmentPolicyBody>;
