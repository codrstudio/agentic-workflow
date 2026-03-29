import { useEffect, useState } from "react"
import { WifiSlash } from "@phosphor-icons/react"

export function OfflineIndicator() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:bottom-4 inset-x-0 z-[100] flex justify-center pointer-events-none">
      <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground shadow-lg pointer-events-auto">
        <WifiSlash className="size-4" />
        <span>Sem conexao</span>
      </div>
    </div>
  )
}
