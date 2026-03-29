import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { Toaster } from "sonner"
import { Question, Warning } from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { ThemeProvider } from "@/components/theme-provider"
import { UpdatePrompt } from "@/components/pwa/update-prompt"
import { OfflineIndicator } from "@/components/pwa/offline-indicator"
import { AppShell } from "@/components/layout/app-shell"

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
        <UpdatePrompt />
        <OfflineIndicator />
      </TooltipProvider>
    </ThemeProvider>
  )
}

function NotFoundPage() {
  return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <Question className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <h1 className="text-lg font-medium">Página não encontrada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O endereço que você acessou não existe.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  )
}

function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex min-h-svh items-center justify-center p-4">
          <div className="text-center">
            <Warning className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <h1 className="text-lg font-medium">Algo deu errado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ocorreu um erro inesperado.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Tentar novamente
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/">Voltar ao início</Link>
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  )
}
