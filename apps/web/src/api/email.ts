import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface EmailAdapterStatus {
  adapterId: string;
  polling: boolean;
  lastPollAt: string | null;
  processedToday: number;
  lastError: string | null;
}

export const emailAdapterStatusQueryOptions = (adapterId: string) =>
  queryOptions({
    queryKey: ["email-adapter-status", adapterId],
    queryFn: () => request<EmailAdapterStatus>(`/adapters/email/${adapterId}/status`),
    refetchInterval: 30_000,
  });
