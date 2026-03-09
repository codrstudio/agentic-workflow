import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SourceEffectiveness {
  source_id: string;
  name: string;
  category: string;
  included: number;
  referenced: number;
  ratio: number;
}

export interface SessionBreakdown {
  session_id: string;
  total_tokens: number;
  by_category: Record<string, number>;
}

export interface ContextMetrics {
  avg_context_tokens: number;
  avg_sources_per_session: number;
  effectiveness_ratio: Record<
    string,
    { included: number; referenced: number; ratio: number }
  >;
  category_distribution: Record<
    string,
    { avg_tokens: number; total_tokens: number; count: number }
  >;
  total_sessions: number;
  session_breakdown: SessionBreakdown[];
  source_effectiveness: SourceEffectiveness[];
}

export function useContextMetrics(projectSlug: string) {
  return useQuery({
    queryKey: ["context-metrics", projectSlug],
    queryFn: () =>
      apiFetch<ContextMetrics>(
        `/hub/projects/${projectSlug}/context/metrics`
      ),
  });
}
