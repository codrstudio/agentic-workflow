import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Notification {
  id: number;
  ts: string;
  type: string;
  severity: "info" | "warning" | "error";
  agentId?: string;
  title: string;
  body?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export function notificationsQueryOptions(params?: {
  unread?: boolean;
  type?: string;
  agent_id?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.unread) searchParams.set("unread", "true");
  if (params?.type) searchParams.set("type", params.type);
  if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();

  return queryOptions({
    queryKey: ["notifications", params],
    queryFn: () =>
      request<{ rows: Notification[]; total: number }>(
        `/notifications${qs ? `?${qs}` : ""}`,
      ),
  });
}

export function notificationCountQueryOptions() {
  return queryOptions({
    queryKey: ["notifications", "count"],
    queryFn: () => request<{ unread: number }>("/notifications/count"),
  });
}

export async function markNotificationRead(id: number) {
  return request<{ status: string }>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead() {
  return request<{ status: string }>("/notifications/read-all", {
    method: "POST",
  });
}

export async function deleteNotification(id: number) {
  return request<{ status: string }>(`/notifications/${id}`, {
    method: "DELETE",
  });
}

export function vapidKeyQueryOptions() {
  return queryOptions({
    queryKey: ["push", "vapid-key"],
    queryFn: async () => {
      try {
        return await request<{ publicKey: string }>("/push/vapid-key");
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
  });
}

export async function subscribeToPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  return request<{ status: string }>("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
}

export async function unsubscribeFromPush(endpoint: string) {
  return request<{ status: string }>("/push/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}
