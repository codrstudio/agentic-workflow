import { useQuery } from "@tanstack/react-query"
import type { ThreadSummaryWithSLA, ThreadFilters, Pagination } from "@workspace/types"
import { api } from "@/lib/api"

export type UseThreadsFilters = ThreadFilters & Pagination

export function useThreads(filters: UseThreadsFilters = {}) {
  const {
    status,
    search,
    sort = "last_activity",
    order = "desc",
    page = 1,
    limit = 20,
    assignee,
    priority,
    labels,
    creator_id,
    channel,
    live_chat,
    created_from,
    created_to,
  } = filters

  return useQuery({
    queryKey: ["threads", filters],
    queryFn: () =>
      api.get<{ data: ThreadSummaryWithSLA[]; total: number; page: number; limit: number }>(
        "/threads",
        {
          params: {
            status,
            search,
            sort,
            order,
            page,
            limit,
            assignee,
            priority,
            labels,
            creator_id,
            channel,
            live_chat,
            created_from,
            created_to,
          },
        }
      ),
    placeholderData: (prev) => prev,
  })
}
