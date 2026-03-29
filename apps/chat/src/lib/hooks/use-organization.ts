import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface RecentThread {
  thread_id: string
  number: number | null
  subject: string
  status: string
  created_at: string
}

export interface Organization {
  id: string
  name: string
  domain: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_at: string
  recent_threads: RecentThread[]
}

export function useOrganization(orgId: string | null | undefined) {
  return useQuery<Organization>({
    queryKey: ["organization", orgId],
    queryFn: () => api.get<Organization>(`/organizations/${orgId}`),
    enabled: !!orgId,
  })
}
