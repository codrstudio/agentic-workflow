import * as React from "react"
import { useSSE, type SSEStatus, type SSEEvent, type UseSSEReturn } from "@/hooks/use-sse"

const SSEContext = React.createContext<UseSSEReturn | null>(null)

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const sse = useSSE()
  return <SSEContext.Provider value={sse}>{children}</SSEContext.Provider>
}

export function useSSEContext(): UseSSEReturn {
  const ctx = React.useContext(SSEContext)
  if (!ctx) throw new Error("useSSEContext must be used inside SSEProvider")
  return ctx
}

// Re-export types so consumers import from one place
export type { SSEStatus, SSEEvent }
