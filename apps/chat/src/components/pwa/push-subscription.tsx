import { useEffect, useState, useCallback } from "react"
import { Bell, BellSlash } from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"

type PushState = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed"

const REPROMPT_KEY = "push-reprompt-at"
const REPROMPT_DAYS = 14

function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("loading")

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported")
      return
    }

    if (Notification.permission === "denied") {
      setState("denied")
      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "unsubscribed"))
      .catch(() => setState("unsupported"))
  }, [])

  const subscribe = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState("denied")
        return
      }

      const { publicKey } = await api.get<{ publicKey: string }>(
        "/push/vapid-key"
      )

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      })

      await api.post("/push/subscribe", subscription.toJSON())
      setState("subscribed")
    } catch {
      setState("unsubscribed")
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await api.delete("/push/subscribe")
      }

      setState("unsubscribed")
    } catch {
      setState("unsubscribed")
    }
  }, [])

  return { state, subscribe, unsubscribe }
}

export function PushPrompt() {
  const { state, subscribe } = usePushSubscription()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state !== "unsubscribed") return

    const repromptAt = localStorage.getItem(REPROMPT_KEY)
    if (repromptAt && Date.now() < Number(repromptAt)) return

    const timer = setTimeout(() => setVisible(true), 10_000)
    return () => clearTimeout(timer)
  }, [state])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    const nextReprompt = Date.now() + REPROMPT_DAYS * 24 * 60 * 60 * 1_000
    localStorage.setItem(REPROMPT_KEY, String(nextReprompt))
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] md:bottom-6 left-4 z-50 w-72 rounded-lg border bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-2">
          <p className="text-sm font-medium">Ativar notificacoes?</p>
          <p className="text-xs text-muted-foreground">
            Receba atualizacoes sobre suas conversas em tempo real.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={subscribe}>
              Ativar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Agora nao
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PushToggle() {
  const { state, subscribe, unsubscribe } = usePushSubscription()

  if (state === "unsupported" || state === "loading") return null

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={state === "subscribed" ? unsubscribe : subscribe}
      disabled={state === "denied"}
      aria-label={
        state === "subscribed" ? "Desativar notificacoes" : "Ativar notificacoes"
      }
    >
      {state === "subscribed" ? (
        <Bell className="size-4" />
      ) : (
        <BellSlash className="size-4" />
      )}
    </Button>
  )
}
