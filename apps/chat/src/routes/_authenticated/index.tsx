import { createFileRoute } from "@tanstack/react-router"
import { Package } from "@phosphor-icons/react"

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <Package size={48} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Nenhum conteúdo ainda</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta área está em construção. Em breve você poderá acessar os recursos do sistema por aqui.
      </p>
    </div>
  )
}
