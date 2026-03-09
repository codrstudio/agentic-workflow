import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Channel {
  slug: string;
  owner: string;
  type: string;
  metadata: Record<string, unknown>;
  description: string;
  listeners: number;
}

export function channelsQueryOptions() {
  return queryOptions({
    queryKey: ["channels"],
    queryFn: () => request<Channel[]>("/channels"),
  });
}

export function channelQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["channels", slug],
    queryFn: () => request<Channel>(`/channels/${slug}`),
  });
}

export async function updateChannel(
  slug: string,
  data: Partial<Pick<Channel, "description" | "owner" | "metadata">>,
): Promise<Channel> {
  return request<Channel>(`/channels/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteChannel(slug: string): Promise<void> {
  await request(`/channels/${slug}`, { method: "DELETE" });
}
