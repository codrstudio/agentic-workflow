import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface JobSummary {
  id: string;
  agentId: string;
  command: string;
  pid: number;
  status: "running" | "completed" | "failed" | "timeout" | "killed";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  exitCode?: number | null;
  tail: string;
  truncated: boolean;
  resourceStats?: { cpu: number; memory: number; sampledAt: number };
}

export function jobsQueryOptions(agentId?: string) {
  return queryOptions({
    queryKey: agentId ? ["jobs", { agentId }] : ["jobs"],
    queryFn: () =>
      request<JobSummary[]>(agentId ? `/jobs?agentId=${agentId}` : "/jobs"),
  });
}

export function jobQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["jobs", id],
    queryFn: () => request<JobSummary>(`/jobs/${id}`),
  });
}

export async function killJob(id: string): Promise<void> {
  await request(`/jobs/${id}/kill`, { method: "POST" });
}

export async function deleteJob(id: string): Promise<void> {
  await request(`/jobs/${id}`, { method: "DELETE" });
}
