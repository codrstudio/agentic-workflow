import { z } from 'zod';

export const OperatorMessageSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  message: z.string(),
  source: z.string().optional(),
});

export type OperatorMessage = z.infer<typeof OperatorMessageSchema>;
