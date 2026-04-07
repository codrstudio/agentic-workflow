import { Link } from "@tanstack/react-router"
import { Button } from "@ui/components/ui/button"
import { MagnifyingGlass } from "@phosphor-icons/react"

export function NotFoundState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <MagnifyingGlass className="size-12 text-muted-foreground" weight="duotone" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Página não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          O endereço que você acessou não existe.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
