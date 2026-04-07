import { cn } from "@ui/lib/utils"
import { CaretRight } from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui/components/ui/tooltip"
import type { MenuItem } from "./types"

interface AppMenuItemProps {
  item: MenuItem
  active?: boolean
  collapsed?: boolean
  onNavigate?: (route: string) => void
  onDrillDown?: (contextId: string) => void
}

export function AppMenuItem({
  item,
  active,
  collapsed,
  onNavigate,
  onDrillDown,
}: AppMenuItemProps) {
  const Icon = item.icon

  const handleClick = () => {
    if (item.children) onDrillDown?.(item.children.id)
    else if (item.route) onNavigate?.(item.route)
  }

  const btn = (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "min-h-[44px] active:scale-[0.98]",
        active &&
          "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.children && (
            <CaretRight className="ml-auto size-4 shrink-0 opacity-50" />
          )}
        </>
      )}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return btn
}
