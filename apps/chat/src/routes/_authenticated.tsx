import { useEffect } from "react"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { AppShell } from "@/components/layout/app-shell"
import { PresenceProvider } from "@/components/presence-provider"
import { sseManager } from "@/lib/sse-manager"
import { getSession, signOut } from "@/lib/auth-client"

const TEAM_ROLES = ["admin", "manager", "attendant"] as const

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session?.data?.user) {
      throw redirect({ to: "/login", search: { returnUrl: location.href } })
    }
    const role = (session.data.user as { role?: string }).role
    const isTeam = TEAM_ROLES.includes(role as (typeof TEAM_ROLES)[number])
    if (!isTeam) {
      await signOut()
      throw redirect({ to: "/login" })
    }
  },
})

function AuthenticatedLayout() {
  const queryClient = useQueryClient()

  useEffect(() => {
    sseManager.connect("/api/v1/chat/events")

    const onThreadCreated = () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] })
    }

    const onThreadClosed = (e: MessageEvent) => {
      const { thread_id } = JSON.parse(e.data || "{}")
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["threads", thread_id] })
    }

    const onThreadReopened = (e: MessageEvent) => {
      const { thread_id } = JSON.parse(e.data || "{}")
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["threads", thread_id] })
    }

    const onCommentCreated = (e: MessageEvent) => {
      const { thread_id } = JSON.parse(e.data || "{}")
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["comments", thread_id] })
    }

    const onLabelsChanged = (e: MessageEvent) => {
      const { thread_id } = JSON.parse(e.data || "{}")
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["threads", thread_id] })
    }

    const onPropertiesChanged = (e: MessageEvent) => {
      const { thread_id } = JSON.parse(e.data || "{}")
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["threads", thread_id] })
    }

    const onThreadUpdated = (e: MessageEvent) => {
      const { thread_id, derived_from } = JSON.parse(e.data || "{}")
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["threads", thread_id] })
      if (derived_from) queryClient.invalidateQueries({ queryKey: ["derivations", derived_from] })
    }

    const onSLAExpired = (e: MessageEvent) => {
      const { thread_id } = JSON.parse(e.data || "{}")
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      if (thread_id) queryClient.invalidateQueries({ queryKey: ["sla", thread_id] })
    }

    sseManager.on("thread.created", onThreadCreated)
    sseManager.on("thread.closed", onThreadClosed)
    sseManager.on("thread.reopened", onThreadReopened)
    sseManager.on("comment.created", onCommentCreated)
    sseManager.on("labels.changed", onLabelsChanged)
    sseManager.on("properties.changed", onPropertiesChanged)
    sseManager.on("thread.updated", onThreadUpdated)
    sseManager.on("sla.expired", onSLAExpired)

    return () => {
      sseManager.off("thread.created", onThreadCreated)
      sseManager.off("thread.closed", onThreadClosed)
      sseManager.off("thread.reopened", onThreadReopened)
      sseManager.off("comment.created", onCommentCreated)
      sseManager.off("labels.changed", onLabelsChanged)
      sseManager.off("properties.changed", onPropertiesChanged)
      sseManager.off("thread.updated", onThreadUpdated)
      sseManager.off("sla.expired", onSLAExpired)
      sseManager.disconnect()
    }
  }, [queryClient])

  return (
    <PresenceProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </PresenceProvider>
  )
}
