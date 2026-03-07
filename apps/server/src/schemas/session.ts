import { z } from "zod";

export const MessageRoleEnum = z.enum(["user", "assistant", "system"]);

export const MessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleEnum,
  content: z.string(),
  created_at: z.string().datetime(),
  artifacts: z.array(z.string()).default([]),
});

export type Message = z.infer<typeof MessageSchema>;

export const SessionStatusEnum = z.enum(["active", "archived"]);

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string().max(200),
  source_ids: z.array(z.string().uuid()),
  messages: z.array(MessageSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  status: SessionStatusEnum,
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const CreateSessionBody = z.object({
  title: z.string().max(200).optional(),
  source_ids: z.array(z.string().uuid()).default([]),
  system_message: z.string().max(5000).optional(),
});

export const UpdateSessionBody = z.object({
  title: z.string().max(200).optional(),
  status: SessionStatusEnum.optional(),
});
