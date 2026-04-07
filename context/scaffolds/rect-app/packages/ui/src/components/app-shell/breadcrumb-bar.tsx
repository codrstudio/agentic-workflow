import { useState } from "react"
import { cn } from "@ui/lib/utils"
import { Button } from "@ui/components/ui/button"
import { Input } from "@ui/components/ui/input"
import { useIsMobile } from "@ui/hooks/use-media-query"
import { List, MagnifyingGlass, CaretLeft } from "@phosphor-icons/react"
import {
  NotificationPanel,
  type NotificationItem,
} from "@ui/components/notifications/notification-panel"

export interface BreadcrumbItem {
  label: string
  route?: string
}

interface BreadcrumbBarProps {
  breadcrumbs?: BreadcrumbItem[]
  pageTitle?: string
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  onNavigate?: (route: string) => void
  onBack?: () => void
  notifications?: NotificationItem[]
  onNotificationsViewAll?: () => void
  onNotificationClick?: (id: string) => void
  onSearch?: (query: string) => void
  canGoBack?: boolean
}

export function BreadcrumbBar({
  breadcrumbs = [],
  pageTitle,
  sidebarCollapsed,
  onToggleSidebar,
  onNavigate,
  onBack,
  notifications = [],
  onNotificationsViewAll,
  onNotificationClick,
  onSearch,
  canGoBack,
}: BreadcrumbBarProps) {
  const isMobile = useIsMobile()
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearchToggle = () => {
    if (searchActive) {
      setSearchActive(false)
      setSearchQuery("")
    } else {
      setSearchActive(true)
    }
  }

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) onSearch?.(searchQuery.trim())
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
      {/* Left */}
      <div className="flex shrink-0 items-center">
        {isMobile ? (
          canGoBack ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={searchActive ? handleSearchToggle : onBack}
              aria-label={searchActive ? "Fechar busca" : "Voltar"}
            >
              <CaretLeft className="size-5" />
            </Button>
          ) : null
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={onToggleSidebar}
            aria-label={
              sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"
            }
          >
            <List className="size-5" />
          </Button>
        )}
      </div>

      {/* Center */}
      <div className="flex min-w-0 flex-1 items-center overflow-hidden px-2">
        {isMobile && searchActive ? (
          <Input
            autoFocus
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            className="h-9"
          />
        ) : isMobile ? (
          <span className="truncate text-sm font-medium">
            {pageTitle || breadcrumbs[breadcrumbs.length - 1]?.label}
          </span>
        ) : (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {crumb.route && i < breadcrumbs.length - 1 ? (
                  <button
                    onClick={() => onNavigate?.(crumb.route!)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className={cn(
                      i === breadcrumbs.length - 1
                        ? "font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-1">
        {!isMobile ? (
          <div className="w-48">
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              className="h-8"
            />
          </div>
        ) : (
          !searchActive && (
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={handleSearchToggle}
              aria-label="Buscar"
            >
              <MagnifyingGlass className="size-5" />
            </Button>
          )
        )}

        <NotificationPanel
          notifications={notifications}
          onViewAll={onNotificationsViewAll}
          onNotificationClick={onNotificationClick}
        />
      </div>
    </header>
  )
}
