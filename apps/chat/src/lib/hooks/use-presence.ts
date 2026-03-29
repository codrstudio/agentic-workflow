import { useState, useEffect, useCallback } from "react"
import { useWebSocket, type TypedSocket } from "@workspace/ui/hooks/use-websocket"
import type { PresenceTeamMember } from "@workspace/types"

export type PresenceStatus = "online" | "paused" | "offline"

const STORAGE_KEY = "presence:status"

function persistStatus(s: PresenceStatus) {
  try { sessionStorage.setItem(STORAGE_KEY, s) } catch { /* SSR / incognito */ }
}

function getPersistedStatus(): PresenceStatus | null {
  try { return sessionStorage.getItem(STORAGE_KEY) as PresenceStatus | null } catch { return null }
}

interface UsePresenceOptions {
  wsUrl: string
  chatLimit?: number
}

interface UsePresenceReturn {
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

export function usePresence({
  wsUrl,
  chatLimit = 1,
}: UsePresenceOptions): UsePresenceReturn {
  const { socket } = useWebSocket({ url: wsUrl })
  const [status, setStatus] = useState<PresenceStatus>("offline")
  const [queueSize, setQueueSize] = useState(0)
  const [onlineTeam, setOnlineTeam] = useState<PresenceTeamMember[]>([])
  const [myChats, setMyChats] = useState<string[]>([])

  const goOnline = useCallback(
    (limit?: number) => {
      socket?.emit("presence.online", { limit: limit ?? chatLimit })
      setStatus("online")
      persistStatus("online")
    },
    [socket, chatLimit]
  )

  const goPaused = useCallback(() => {
    socket?.emit("presence.paused")
    setStatus("paused")
    persistStatus("paused")
  }, [socket])

  const goOffline = useCallback(() => {
    socket?.emit("presence.offline")
    setStatus("offline")
    persistStatus("offline")
    setOnlineTeam([])
    setMyChats([])
  }, [socket])

  const takeChat = useCallback(
    (threadId: string) => {
      socket?.emit("queue.take", { threadId })
    },
    [socket]
  )

  useEffect(() => {
    if (!socket) return

    const onQueueUpdate = ({ size }: { size: number }) => setQueueSize(size)

    const onSnapshot = (data: {
      team: PresenceTeamMember[]
      myChats: string[]
      queueSize: number
    }) => {
      setOnlineTeam(data.team)
      setMyChats(data.myChats)
      setQueueSize(data.queueSize)
    }

    const onPresenceOnline = ({ userId, name }: { userId: string; name: string }) => {
      setOnlineTeam((prev) => {
        const exists = prev.find((m) => m.userId === userId)
        if (exists) return prev.map((m) => (m.userId === userId ? { ...m, status: "online" as const, name } : m))
        return [...prev, { userId, name, status: "online" }]
      })
    }

    const onPresenceOffline = ({ userId }: { userId: string }) => {
      setOnlineTeam((prev) => prev.filter((m) => m.userId !== userId))
    }

    const onPresencePaused = ({ userId, name }: { userId: string; name: string }) => {
      setOnlineTeam((prev) => {
        const exists = prev.find((m) => m.userId === userId)
        if (exists) return prev.map((m) => (m.userId === userId ? { ...m, status: "paused" as const, name } : m))
        return [...prev, { userId, name, status: "paused" }]
      })
    }

    const onAttendanceUpdate = ({ chats }: { chats: string[] }) => {
      setMyChats(chats)
    }

    socket.on("queue.update", onQueueUpdate)
    socket.on("presence.snapshot", onSnapshot)
    socket.on("presence.online", onPresenceOnline)
    socket.on("presence.offline", onPresenceOffline)
    socket.on("presence.paused", onPresencePaused)
    socket.on("attendance.update", onAttendanceUpdate)

    // Restore previous status on (re)connect (covers F5 and reconnect)
    const restorePresence = () => {
      const prev = getPersistedStatus()
      if (prev === "online") {
        socket.emit("presence.online", { limit: chatLimit })
        setStatus("online")
      } else if (prev === "paused") {
        socket.emit("presence.online", { limit: chatLimit })
        // Go online first so server creates presence, then immediately pause
        socket.emit("presence.paused")
        setStatus("paused")
      }
    }

    // If socket is already connected (missed the connect event), restore immediately
    if (socket.connected) {
      restorePresence()
    }
    socket.on("connect", restorePresence)

    return () => {
      socket.off("connect", restorePresence)
      socket.off("queue.update", onQueueUpdate)
      socket.off("presence.snapshot", onSnapshot)
      socket.off("presence.online", onPresenceOnline)
      socket.off("presence.offline", onPresenceOffline)
      socket.off("presence.paused", onPresencePaused)
      socket.off("attendance.update", onAttendanceUpdate)
    }
  }, [socket, chatLimit])

  // No explicit cleanup on unmount — rely on the backend's 5s disconnect grace period.
  // An explicit presence.offline here would race with F5/reconnect and kill presence prematurely.

  return { status, queueSize, onlineTeam, myChats, socket, goOnline, goPaused, goOffline, takeChat }
}
