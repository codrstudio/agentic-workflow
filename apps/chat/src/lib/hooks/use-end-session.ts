import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function useEndSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      return api.post(`/threads/${threadId}/end-session`)
    },
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      queryClient.invalidateQueries({ queryKey: ["threads", threadId] })
      queryClient.invalidateQueries({ queryKey: ["comments", threadId] })
    },
  })
}
