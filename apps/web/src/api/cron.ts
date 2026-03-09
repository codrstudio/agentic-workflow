import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface CronSchedule {
  kind: "at" | "every" | "cron";
  at?: string;
  everyMs?: number;
  anchorMs?: number;
  expr?: string;
  tz?: string;
}

export interface CronPayload {
  kind: "heartbeat" | "conversation" | "request";
  message?: string;
}

export interface CronJobDef {
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  description?: string;
}

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
}

export interface CronJob {
  slug: string;
  agentId: string;
  def: CronJobDef;
  state: CronJobState;
}

export function cronJobsQueryOptions(params?: {
  agentId?: string;
  includeDisabled?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.agentId) searchParams.set("agentId", params.agentId);
  if (params?.includeDisabled) searchParams.set("includeDisabled", "true");
  const qs = searchParams.toString();

  return queryOptions({
    queryKey: ["cron-jobs", params?.agentId ?? "all", params?.includeDisabled ?? true],
    queryFn: () =>
      request<CronJob[]>(`/cron/jobs${qs ? `?${qs}` : ""}`),
  });
}

export function cronJobQueryOptions(agentId: string, slug: string) {
  return queryOptions({
    queryKey: ["cron-jobs", agentId, slug],
    queryFn: () => request<CronJob>(`/cron/jobs/${agentId}/${slug}`),
  });
}

export async function runCronJobManually(agentId: string, slug: string) {
  return request<{ ok?: boolean; status?: string }>(
    `/cron/jobs/${agentId}/${slug}/run?mode=force`,
    { method: "POST" }
  );
}

export interface CreateCronJobPayload {
  agentId: string;
  slug: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  description?: string;
}

export async function createCronJob(payload: CreateCronJobPayload) {
  return request<CronJob>("/cron/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export interface UpdateCronJobPayload {
  name?: string;
  enabled?: boolean;
  schedule?: CronSchedule;
  payload?: CronPayload;
  description?: string;
}

export async function updateCronJob(
  agentId: string,
  slug: string,
  payload: UpdateCronJobPayload
) {
  return request<CronJob>(`/cron/jobs/${agentId}/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteCronJob(agentId: string, slug: string) {
  return request<{ ok: boolean }>(`/cron/jobs/${agentId}/${slug}`, {
    method: "DELETE",
  });
}

export interface CronRunEntry {
  id?: number;
  ts: number;
  status: "ok" | "error" | "timeout" | "skipped";
  duration_ms: number;
  tokens?: { input?: number; output?: number };
  cost_usd?: number;
  preview?: string;
  error?: string;
}

export function cronRunHistoryQueryOptions(
  agentId: string,
  slug: string,
  page = 1,
  limit = 20,
) {
  return queryOptions({
    queryKey: ["cron-runs", agentId, slug, page],
    queryFn: () =>
      request<{ runs: CronRunEntry[]; total: number }>(
        `/cron/jobs/${agentId}/${slug}/runs?page=${page}&limit=${limit}`,
      ),
  });
}
