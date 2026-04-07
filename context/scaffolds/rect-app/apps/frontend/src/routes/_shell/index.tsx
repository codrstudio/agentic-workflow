import { createFileRoute } from "@tanstack/react-router"
import { Hand, Rocket, Layout, Palette } from "@phosphor-icons/react"
import { PageDefault } from "@ui/components/page-layout"

export const Route = createFileRoute("/_shell/")({
  component: HomePage,
})

function HomePage() {
  return (
    <PageDefault className="flex-1 items-center justify-center">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Hand className="size-8" weight="fill" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bem-vindo ao seu app
          </h1>
          <p className="text-muted-foreground">
            Este é o ponto de partida do seu projeto. Use o menu lateral para
            navegar e comece a construir suas páginas.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-3">
          <WelcomeCard
            icon={<Layout className="size-5" />}
            title="Páginas"
            description="Crie rotas em src/routes"
          />
          <WelcomeCard
            icon={<Palette className="size-5" />}
            title="Componentes"
            description="Use e customize o design system"
          />
          <WelcomeCard
            icon={<Rocket className="size-5" />}
            title="Deploy"
            description="PWA pronto para produção"
          />
        </div>
      </div>
    </PageDefault>
  )
}

function WelcomeCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 text-left">
      <div className="mb-2 text-muted-foreground">{icon}</div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
