import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface User {
  id: string
  name: string
  email: string
  roles: string[]
  status: string
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () =>
      api.get<{ data: User[]; total: number }>("/users", {
        params: { role: "attendant,manager,admin", status: "active" },
      }),
    staleTime: 5 * 60 * 1000,
  })
}
