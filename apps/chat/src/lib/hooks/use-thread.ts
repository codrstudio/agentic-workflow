import { useQuery } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

export function useThread(threadId: string | undefined) {
  return useQuery({
    queryKey: ["threads", threadId],
    queryFn: () => api.get<Gatekeeper>(`/threads/${threadId}/gatekeeper`),
    enabled: !!threadId,
  })
}
