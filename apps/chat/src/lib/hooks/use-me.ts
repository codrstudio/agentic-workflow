import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface Me {
  id: string
  email: string
  roles: string[]
}

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
