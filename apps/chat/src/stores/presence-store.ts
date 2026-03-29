import { create } from "zustand"

interface PresenceUser {
  id: string
  name: string
  status: "online" | "offline" | "paused"
}

interface TypingState {
  threadId: string
  userId: string
  userName: string
}

interface PresenceStore {
  onlineUsers: PresenceUser[]
  typing: TypingState[]
  queueCount: number

  setOnlineUsers: (users: PresenceUser[]) => void
  addTyping: (state: TypingState) => void
  removeTyping: (threadId: string, userId: string) => void
  setQueueCount: (count: number) => void
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  onlineUsers: [],
  typing: [],
  queueCount: 0,

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  addTyping: (state) =>
    set((s) => ({
      typing: [
        ...s.typing.filter(
          (t) => !(t.threadId === state.threadId && t.userId === state.userId)
        ),
        state,
      ],
    })),

  removeTyping: (threadId, userId) =>
    set((s) => ({
      typing: s.typing.filter(
        (t) => !(t.threadId === threadId && t.userId === userId)
      ),
    })),

  setQueueCount: (count) => set({ queueCount: count }),
}))
