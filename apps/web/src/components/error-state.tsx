import * as React from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { AlertTriangle, RefreshCw, Home, ChevronDown, Compass } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

type ErrorStateProps = {
  error: Error
  reset?: () => void
}

export function ErrorState({ error, reset }: ErrorStateProps) {
  const router = useRouter()
  const [showDetails, setShowDetails] = React.useState(false)

  const handleRetry = () => {
    reset?.()
    void router.invalidate()
  }

  const message = error?.message || "Ocorreu um erro inesperado."
  const stack = error?.stack

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          Esta página encontrou um problema ao carregar. Você pode tentar novamente ou voltar para o início.
        </p>

        <div className="mt-5 flex items-center gap-2">
          <Button variant="default" onClick={handleRetry}>
            <RefreshCw />
            Tentar novamente
          </Button>
          <Button variant="outline" asChild>
            <Link to="/projects">
              <Home />
              Ir para projetos
            </Link>
          </Button>
        </div>

        <div className="mt-6 w-full">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`}
            />
            {showDetails ? "Ocultar detalhes técnicos" : "Mostrar detalhes técnicos"}
          </button>

          {showDetails && (
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted/40 text-left">
              <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {error?.name || "Error"}
              </div>
              <pre className="max-h-64 overflow-auto px-3 py-2 text-xs leading-relaxed text-foreground/90">
                {message}
                {stack ? `\n\n${stack}` : ""}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotFoundState({
  title = "Página não encontrada",
  description = "O endereço que você tentou acessar não existe ou foi movido.",
}: {
  title?: string
  description?: string
} = {}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-7" />
        </div>
        <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Erro 404
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Button variant="default" asChild>
            <Link to="/projects">
              <Home />
              Ir para projetos
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
