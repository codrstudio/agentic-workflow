import { useQuery } from "@tanstack/react-query"
import type { SLAInfo } from "@workspace/types"
import { api } from "@/lib/api"

export function useSLA(threadId: string | undefined) {
  return useQuery({
    queryKey: ["sla", threadId],
    queryFn: () => api.get<SLAInfo>(`/threads/${threadId}/sla`),
    enabled: !!threadId,
    refetchInterval: 60_000,
  })
}
