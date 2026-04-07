import { useRouter, type ErrorComponentProps } from "@tanstack/react-router"
import { Button } from "@ui/components/ui/button"
import { WarningCircle } from "@phosphor-icons/react"

export function ErrorState({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <WarningCircle className="size-12 text-destructive" weight="duotone" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Erro inesperado"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset()
            router.invalidate()
          }}
        >
          Tentar novamente
        </Button>
        <Button variant="outline" size="sm" onClick={() => router.navigate({ to: "/" })}>
          Voltar ao início
        </Button>
      </div>
    </div>
  )
}
