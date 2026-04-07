import { createFileRoute } from "@tanstack/react-router"
import { Bell, BellRinging, CheckCircle, Checks } from "@phosphor-icons/react"
import { PageDefault } from "@ui/components/page-layout"
import { Button } from "@ui/components/ui/button"
import { Separator } from "@ui/components/ui/separator"
import { Badge } from "@ui/components/ui/badge"
import { cn } from "@ui/lib/utils"
import type { NotificationItem } from "@ui/components/notifications/notification-panel"

export const Route = createFileRoute("/_shell/notifications")({
  component: NotificationsPage,
  staticData: { breadcrumb: "Notificacoes" },
})

// Mock data — will be replaced by real data source
const mockNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Nova mensagem recebida",
    description:
      "Voce recebeu uma nova mensagem de Maria Silva sobre o projeto de redesign.",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "2",
    title: "Tarefa atribuida a voce",
    description:
      "Carlos Oliveira atribuiu a tarefa 'Revisar componentes de UI' para voce.",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "3",
    title: "Deploy concluido",
    description: "O deploy da versao 2.1.0 foi concluido com sucesso no ambiente de staging.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
  {
    id: "4",
    title: "Comentario em pull request",
    description:
      "Ana Rodrigues comentou no PR #42: 'Otima implementacao, so falta ajustar o padding.'",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
  {
    id: "5",
    title: "Lembrete: reuniao em 15 minutos",
    description: "A reuniao de sprint planning comeca as 14h. Nao esqueca de preparar seus pontos.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
]

function formatDate(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "Agora mesmo"
  if (diffMin < 60) return `Ha ${diffMin} minutos`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Ha ${diffH} ${diffH === 1 ? "hora" : "horas"}`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Ha ${diffD} ${diffD === 1 ? "dia" : "dias"}`

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Bell className="size-7 text-muted-foreground" />
      </div>
      <div className="max-w-xs space-y-2">
        <h2 className="text-lg font-semibold">Nenhuma notificacao</h2>
        <p className="text-sm text-muted-foreground">
          Voce esta em dia! Quando houver atualizacoes, mensagens ou alertas,
          eles aparecerao aqui.
        </p>
      </div>
    </div>
  )
}

function NotificationsPage() {
  // Toggle between mock data and empty to preview both states
  // Set to [] to see empty state
  const notifications = mockNotifications
  const unreadCount = notifications.filter((n) => !n.read).length

  if (notifications.length === 0) {
    return (
      <PageDefault className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Notificacoes
          </h1>
        </div>
        <EmptyState />
      </PageDefault>
    )
  }

  return (
    <PageDefault className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Notificacoes
          </h1>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} novas</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground">
            <Checks className="size-3.5" />
            Marcar como lidas
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {notifications.map((n, i) => (
          <div key={n.id}>
            <button
              className={cn(
                "flex w-full gap-4 rounded-lg px-4 py-3 text-left transition-colors hover:bg-accent",
                !n.read && "bg-accent/50",
              )}
            >
              <div className="mt-1 shrink-0">
                {n.read ? (
                  <CheckCircle className="size-5 text-muted-foreground" />
                ) : (
                  <BellRinging
                    className="size-5 text-primary"
                    weight="fill"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm",
                      !n.read && "font-medium",
                    )}
                  >
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(n.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {n.description}
                </p>
              </div>
            </button>
            {i < notifications.length - 1 && <Separator className="my-0.5" />}
          </div>
        ))}
      </div>
    </PageDefault>
  )
}
