import { useRegisterSW } from "virtual:pwa-register/react"
import { Button } from "@ui/components/ui/button"
import { X } from "@phosphor-icons/react"

export function PWAReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div className="bg-primary text-primary-foreground fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg p-4 shadow-lg sm:left-auto sm:right-4 sm:max-w-sm">
      <p className="flex-1 text-sm font-medium">Nova versão disponível</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateServiceWorker(true)}
      >
        Atualizar
      </Button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-primary-foreground/70 hover:text-primary-foreground"
        aria-label="Dispensar"
      >
        <X size={18} />
      </button>
    </div>
  )
}
