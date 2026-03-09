import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface BenchmarkRun {
  id: string;
  agentId: string;
  trigger: "manual" | "version_change";
  versionFrom: string | null;
  versionTo: string;
  evalSetId: string;
  status: "pending" | "running" | "done" | "failed";
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
  regression: boolean;
  casesTotal: number | null;
  casesPassed: number | null;
  casesFailed: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BenchmarkListResponse {
  agentId: string;
  total: number;
  limit: number;
  offset: number;
  items: BenchmarkRun[];
}

export interface BenchmarkTrendPoint {
  benchmarkId: string;
  version: string;
  score: number | null;
  delta: number | null;
  regression: boolean;
  date: string;
}

export interface BenchmarkTrendResponse {
  agentId: string;
  trend: BenchmarkTrendPoint[];
}

export interface BenchmarkCase {
  id: string;
  caseId: string;
  input: string;
  expected: string;
  responseBefore: string | null;
  responseAfter: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
  judgeReasoning: string | null;
}

export interface BenchmarkCasesResponse {
  benchmarkId: string;
  total: number;
  limit: number;
  offset: number;
  cases: BenchmarkCase[];
}

export const benchmarkRunsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["benchmark-runs", agentId],
    queryFn: () =>
      request<BenchmarkListResponse>(`/agents/${agentId}/benchmarks?limit=20`),
  });

export const benchmarkTrendQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["benchmark-trend", agentId],
    queryFn: () =>
      request<BenchmarkTrendResponse>(`/agents/${agentId}/benchmarks/trend`),
  });

export const benchmarkRunDetailQueryOptions = (agentId: string, runId: string) =>
  queryOptions({
    queryKey: ["benchmark-run", agentId, runId],
    queryFn: () =>
      request<BenchmarkRun>(`/agents/${agentId}/benchmarks/${runId}`),
  });

export const benchmarkCasesQueryOptions = (agentId: string, runId: string) =>
  queryOptions({
    queryKey: ["benchmark-cases", agentId, runId],
    queryFn: () =>
      request<BenchmarkCasesResponse>(
        `/agents/${agentId}/benchmarks/${runId}/cases`,
      ),
  });

export const benchmarkLatestQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["benchmark-latest", agentId],
    queryFn: async () => {
      const result = await request<BenchmarkListResponse>(
        `/agents/${agentId}/benchmarks?limit=1`,
      );
      return result.items[0] ?? null;
    },
  });
