import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface CreateThreadBody {
  text: string
  visibility: string
  channel: string
}

export function useCreateThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateThreadBody) =>
      api.post<{ thread_id: string }>("/threads", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] })
    },
  })
}
