import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface BulkResult {
  success: number
  failed: number
  errors: { thread_id: string; error: string }[]
}

export function useBulkClose() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (thread_ids: string[]) =>
      api.post<BulkResult>("/threads/bulk/close", { thread_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] })
    },
  })
}

export function useBulkAssign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      thread_ids,
      assignee_id,
    }: {
      thread_ids: string[]
      assignee_id: string
    }) => api.post<BulkResult>("/threads/bulk/assign", { thread_ids, assignee_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] })
    },
  })
}

export function useBulkLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      thread_ids,
      label_id,
    }: {
      thread_ids: string[]
      label_id: string
    }) => api.post<BulkResult>("/threads/bulk/label", { thread_ids, label_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] })
    },
  })
}
