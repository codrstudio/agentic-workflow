import { z } from "zod";

export const TokenUsageContextEnum = z.enum([
  "chat_session",
  "pipeline_phase",
  "feature_spawn",
  "review_agent",
  "merge_agent",
]);

export const TokenUsageModelEnum = z.enum([
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "other",
]);

export const TokenUsageRecordSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  session_id: z.string().optional(),
  feature_id: z.string().optional(),
  phase: z.string().optional(),
  context: TokenUsageContextEnum,
  model: TokenUsageModelEnum,
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_read_tokens: z.number().int().nonnegative().default(0),
  cost_usd: z.number().nonnegative(),
  recorded_at: z.string().datetime(),
});

export const CreateTokenUsageBody = z.object({
  session_id: z.string().optional(),
  feature_id: z.string().optional(),
  phase: z.string().optional(),
  context: TokenUsageContextEnum,
  model: TokenUsageModelEnum,
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_read_tokens: z.number().int().nonnegative().default(0),
  cost_usd: z.number().nonnegative().optional(),
});

export type TokenUsageRecord = z.infer<typeof TokenUsageRecordSchema>;
export type CreateTokenUsageBodyType = z.infer<typeof CreateTokenUsageBody>;

// Price table: per million tokens [input, output, cache_read]
export const PRICE_TABLE: Record<string, [number, number, number]> = {
  "claude-haiku-4-5": [0.80, 4.00, 0.08],
  "claude-sonnet-4-6": [3.00, 15.00, 0.30],
  "claude-opus-4-6": [15.00, 75.00, 1.50],
  other: [3.00, 15.00, 0.30], // same as sonnet
};

export function calculateCostUsd(
  model: string,
  input_tokens: number,
  output_tokens: number,
  cache_read_tokens: number
): number {
  const prices = PRICE_TABLE[model] ?? PRICE_TABLE["other"]!;
  const [inputPrice, outputPrice, cachePrice] = prices;
  return (
    (input_tokens * inputPrice +
      output_tokens * outputPrice +
      cache_read_tokens * cachePrice) /
    1_000_000
  );
}
