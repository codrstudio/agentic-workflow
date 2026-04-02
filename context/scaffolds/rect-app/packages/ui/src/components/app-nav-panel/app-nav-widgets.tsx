import { cn } from "@ui/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui/components/ui/tooltip"
import type { MenuWidget } from "@ui/components/app-menu/types"

interface AppNavWidgetsProps {
  widgets?: MenuWidget[]
  collapsed?: boolean
}

export function AppNavWidgets({ widgets, collapsed }: AppNavWidgetsProps) {
  if (!widgets || widgets.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {widgets.map((widget) => {
        const Icon = widget.icon

        if (collapsed) {
          return (
            <Tooltip key={widget.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={widget.onClick}
                  className="flex items-center justify-center gap-1.5 rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Icon className="size-5 shrink-0" />
                  {widget.value && (
                    <span className="text-xs font-medium">{widget.value}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {widget.label}
                {widget.value && ` · ${widget.value}`}
              </TooltipContent>
            </Tooltip>
          )
        }

        return (
          <button
            key={widget.id}
            onClick={widget.onClick}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{widget.label}</span>
            {widget.value && (
              <span className="ml-auto text-xs font-medium">
                {widget.value}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
