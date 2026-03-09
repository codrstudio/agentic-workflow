import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface EvalCase {
  id: number;
  set_id: number;
  input: string;
  expected: string;
  tags?: string;
  created_at: string;
}

export interface EvalSet {
  id: number;
  agent_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  cases?: EvalCase[];
}

export interface EvalResult {
  id: number;
  run_id: number;
  case_id: number;
  input: string;
  expected: string;
  actual: string;
  score: number;
  reasoning?: string;
  passed: number;
  latency_ms?: number;
  created_at: string;
}

export interface EvalRun {
  id: number;
  set_id: number;
  agent_id: string;
  status: string;
  score_avg?: number;
  total_cases: number;
  passed: number;
  failed: number;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface EvalRunDetail extends EvalRun {
  results: EvalResult[];
}

export const evalSetsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["eval-sets", agentId],
    queryFn: () => request<EvalSet[]>(`/agents/${agentId}/eval-sets`),
  });

export const evalRunsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["eval-runs", agentId],
    queryFn: () => request<EvalRun[]>(`/agents/${agentId}/eval-runs`),
  });

export const evalRunDetailQueryOptions = (agentId: string, runId: string) =>
  queryOptions({
    queryKey: ["eval-runs", agentId, runId],
    queryFn: () => request<EvalRunDetail>(`/agents/${agentId}/eval-runs/${runId}`),
  });
