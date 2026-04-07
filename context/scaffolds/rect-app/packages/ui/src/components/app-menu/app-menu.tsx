import { useState, useCallback } from "react"
import { cn } from "@ui/lib/utils"
import { CaretLeft } from "@phosphor-icons/react"
import { AppMenuItem } from "./app-menu-item"
import type { MenuContext } from "./types"

interface AppMenuProps {
  root: MenuContext
  activeRoute?: string
  collapsed?: boolean
  onNavigate?: (route: string) => void
}

export function AppMenu({
  root,
  activeRoute,
  collapsed,
  onNavigate,
}: AppMenuProps) {
  const [contextStack, setContextStack] = useState<MenuContext[]>([root])
  const current = contextStack[contextStack.length - 1]

  const handleDrillDown = useCallback(
    (contextId: string) => {
      const find = (ctx: MenuContext): MenuContext | null => {
        for (const g of ctx.groups) {
          for (const item of g.items) {
            if (item.children?.id === contextId) return item.children
            if (item.children) {
              const found = find(item.children)
              if (found) return found
            }
          }
        }
        return null
      }
      const found = find(root)
      if (found) setContextStack((prev) => [...prev, found])
    },
    [root],
  )

  const handleBack = useCallback(() => {
    setContextStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div
        className={cn(
          "flex flex-col gap-1 py-2",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {contextStack.length > 1 && !collapsed && (
          <button
            onClick={handleBack}
            className="flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <CaretLeft className="size-4" />
            Voltar
          </button>
        )}

        {current.title && !collapsed && (
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {current.title}
          </div>
        )}

        {current.groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label && !collapsed && (
              <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <AppMenuItem
                key={item.id}
                item={item}
                active={item.route === activeRoute}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onDrillDown={handleDrillDown}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
