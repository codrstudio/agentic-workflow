import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Webhook {
  id: string;
  agentId: string;
  name: string;
  secret: string;
  enabled: boolean;
  description: string | null;
  filters: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  agentId: string;
  receivedAt: string;
  headers: Record<string, string>;
  payload: unknown;
  status: "pending" | "done" | "failed";
  error: string | null;
  processedAt: string | null;
}

export function webhooksQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["webhooks", agentId],
    queryFn: () => request<Webhook[]>(`/agents/${agentId}/webhooks`),
  });
}

export function webhookEventsQueryOptions(agentId: string, webhookId: string) {
  return queryOptions({
    queryKey: ["webhook-events", agentId, webhookId],
    queryFn: () =>
      request<WebhookEvent[]>(`/agents/${agentId}/webhooks/${webhookId}/events`),
  });
}

export interface CreateWebhookPayload {
  name: string;
  description?: string;
  filters?: string[];
}

export async function createWebhook(agentId: string, payload: CreateWebhookPayload): Promise<Webhook> {
  return request<Webhook>(`/agents/${agentId}/webhooks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateWebhookPayload {
  name?: string;
  description?: string;
  filters?: string[];
  enabled?: boolean;
}

export async function updateWebhook(
  agentId: string,
  webhookId: string,
  payload: UpdateWebhookPayload,
): Promise<Webhook> {
  return request<Webhook>(`/agents/${agentId}/webhooks/${webhookId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWebhook(agentId: string, webhookId: string): Promise<void> {
  await request(`/agents/${agentId}/webhooks/${webhookId}`, { method: "DELETE" });
}
