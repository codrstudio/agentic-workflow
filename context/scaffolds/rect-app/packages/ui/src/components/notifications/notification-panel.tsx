import { useState } from "react"
import { Bell, BellRinging, ArrowRight } from "@phosphor-icons/react"
import { Button } from "@ui/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ui/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@ui/components/ui/drawer"
import { Separator } from "@ui/components/ui/separator"
import { ScrollArea } from "@ui/components/ui/scroll-area"
import { useIsMobile } from "@ui/hooks/use-media-query"
import { cn } from "@ui/lib/utils"

export interface NotificationItem {
  id: string
  title: string
  description: string
  timestamp: string
  read: boolean
}

interface NotificationPanelProps {
  notifications?: NotificationItem[]
  onViewAll?: () => void
  onNotificationClick?: (id: string) => void
}

function timeAgo(timestamp: string) {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d`
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Bell className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Nenhuma notificacao</p>
        <p className="text-xs text-muted-foreground">
          Quando houver novidades, elas aparecerao aqui.
        </p>
      </div>
    </div>
  )
}

function NotificationList({
  notifications,
  onNotificationClick,
}: {
  notifications: NotificationItem[]
  onNotificationClick?: (id: string) => void
}) {
  return (
    <div className="flex flex-col">
      {notifications.map((n, i) => (
        <div key={n.id}>
          <button
            onClick={() => onNotificationClick?.(n.id)}
            className={cn(
              "flex w-full gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent",
              !n.read && "bg-accent/50",
            )}
          >
            <div className="mt-0.5 shrink-0">
              <BellRinging
                className={cn(
                  "size-4",
                  n.read ? "text-muted-foreground" : "text-primary",
                )}
                weight={n.read ? "regular" : "fill"}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-sm",
                    !n.read && "font-medium",
                  )}
                >
                  {n.title}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {timeAgo(n.timestamp)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {n.description}
              </p>
            </div>
          </button>
          {i < notifications.length - 1 && <Separator className="my-0.5" />}
        </div>
      ))}
    </div>
  )
}

function PanelContent({
  notifications = [],
  onViewAll,
  onNotificationClick,
}: NotificationPanelProps) {
  const hasNotifications = notifications.length > 0

  return (
    <>
      {hasNotifications ? (
        <ScrollArea className="max-h-80">
          <div className="p-2">
            <NotificationList
              notifications={notifications}
              onNotificationClick={onNotificationClick}
            />
          </div>
        </ScrollArea>
      ) : (
        <EmptyState />
      )}

      <Separator />

      <div className="p-1.5">
        <Button
          variant="ghost"
          className="w-full justify-center gap-2 text-sm text-muted-foreground"
          onClick={onViewAll}
        >
          Ver todas as notificacoes
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </>
  )
}

export function NotificationPanel({
  notifications = [],
  onViewAll,
  onNotificationClick,
}: NotificationPanelProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  const bellButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-11 md:size-9"
      aria-label="Notificacoes"
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  )

  const handleViewAll = () => {
    setOpen(false)
    onViewAll?.()
  }

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{bellButton}</div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Notificacoes</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <PanelContent
                notifications={notifications}
                onViewAll={handleViewAll}
                onNotificationClick={(id) => {
                  setOpen(false)
                  onNotificationClick?.(id)
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{bellButton}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-medium">Notificacoes</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} {unreadCount === 1 ? "nova" : "novas"}
            </span>
          )}
        </div>
        <Separator />
        <PanelContent
          notifications={notifications}
          onViewAll={handleViewAll}
          onNotificationClick={(id) => {
            setOpen(false)
            onNotificationClick?.(id)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
