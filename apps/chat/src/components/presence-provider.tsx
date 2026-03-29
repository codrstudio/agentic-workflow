import { createContext, useContext, type ReactNode } from "react"
import { usePresence, type PresenceStatus } from "@/lib/hooks/use-presence"
import type { TypedSocket } from "@workspace/ui/hooks/use-websocket"
import type { PresenceTeamMember } from "@workspace/types"

interface PresenceContextValue {
  status: PresenceStatus
  queueSize: number
  onlineTeam: PresenceTeamMember[]
  myChats: string[]
  socket: TypedSocket | null
  goOnline: (limit?: number) => void
  goPaused: () => void
  goOffline: () => void
  takeChat: (threadId: string) => void
}

const PresenceContext = createContext<PresenceContextValue | null>(null)

const WS_URL = import.meta.env.VITE_WS_URL || "/ws"

export function PresenceProvider({ children }: { children: ReactNode }) {
  const presence = usePresence({ wsUrl: WS_URL })

  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresenceContext(): PresenceContextValue {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error("usePresenceContext must be used within PresenceProvider")
  return ctx
}
