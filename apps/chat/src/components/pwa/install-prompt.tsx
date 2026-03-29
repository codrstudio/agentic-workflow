import { useEffect, useState, useCallback } from "react"
import { DownloadSimple, X } from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pwa-install-dismissed"

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  )
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(DISMISS_KEY) === "true"
  )

  useEffect(() => {
    if (isInStandaloneMode() || dismissed) return

    if (isIOS()) {
      const timer = setTimeout(() => setShowIOSGuide(true), 3_000)
      return () => clearTimeout(timer)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [dismissed])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setDeferredPrompt(null)
    setShowIOSGuide(false)
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, "true")
  }, [])

  if (!deferredPrompt && !showIOSGuide) return null

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] md:bottom-6 right-4 z-50 w-72 rounded-lg border bg-card p-4 shadow-lg">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3">
        <DownloadSimple className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-2">
          <p className="text-sm font-medium">Instalar Portal</p>

          {showIOSGuide ? (
            <p className="text-xs text-muted-foreground">
              Toque em{" "}
              <span className="inline-block rounded border px-1">
                Compartilhar
              </span>{" "}
              e depois em{" "}
              <span className="inline-block rounded border px-1">
                Adicionar a Tela de Inicio
              </span>
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Acesso rapido direto da sua tela inicial.
              </p>
              <Button size="sm" onClick={handleInstall}>
                Instalar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
