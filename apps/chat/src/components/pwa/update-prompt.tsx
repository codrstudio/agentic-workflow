import { useRegisterSW } from "virtual:pwa-register/react"
import { Button } from "@workspace/ui/components/button"
import { ArrowsClockwise, X } from "@phosphor-icons/react"

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-between gap-3 bg-primary px-4 py-2 text-primary-foreground text-sm pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <span>Nova versao disponivel</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => updateServiceWorker(true)}
        >
          <ArrowsClockwise className="size-3" />
          Atualizar
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setNeedRefresh(false)}
          aria-label="Fechar"
          className="text-primary-foreground hover:text-primary-foreground/80"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  )
}
