import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface SLASummary {
  completed: number
  warning: number
  expired: number
  running: number
  completion_rate: number
}

export interface SLAThreadItem {
  thread_id: string
  subject: string
  number: number | null
  priority: string
  sla_status: string
  remaining_minutes: number
  assignee: { id: string; name: string | null } | null
}

export interface SLAThreadsResponse {
  data: SLAThreadItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface SLASummaryParams {
  period: 7 | 30 | 90
  assignee_id?: string
}

interface SLAThreadsParams {
  period: 7 | 30 | 90
  assignee_id?: string
  status?: string
  page: number
  limit: number
}

export function useSLASummary(params: SLASummaryParams) {
  return useQuery({
    queryKey: ["sla-summary", params.period, params.assignee_id],
    queryFn: () =>
      api.get<SLASummary>("/sla/summary", {
        params: {
          period: String(params.period),
          ...(params.assignee_id ? { assignee_id: params.assignee_id } : {}),
        },
      }),
    staleTime: 60_000,
  })
}

export function useSLAThreads(params: SLAThreadsParams) {
  return useQuery({
    queryKey: [
      "sla-threads",
      params.period,
      params.assignee_id,
      params.status,
      params.page,
      params.limit,
    ],
    queryFn: () =>
      api.get<SLAThreadsResponse>("/sla/threads", {
        params: {
          period: String(params.period),
          page: String(params.page),
          limit: String(params.limit),
          ...(params.assignee_id ? { assignee_id: params.assignee_id } : {}),
          ...(params.status ? { status: params.status } : {}),
        },
      }),
    staleTime: 30_000,
  })
}
