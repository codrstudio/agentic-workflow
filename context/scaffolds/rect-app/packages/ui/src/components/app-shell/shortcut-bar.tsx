import { cn } from "@ui/lib/utils"
import { List } from "@phosphor-icons/react"
import type { MenuItem } from "@ui/components/app-menu/types"

interface ShortcutBarProps {
  shortcuts: MenuItem[]
  activeRoute?: string
  onNavigate?: (route: string) => void
  onMenuOpen?: () => void
  menuOpen?: boolean
}

export function ShortcutBar({
  shortcuts,
  activeRoute,
  onNavigate,
  onMenuOpen,
  menuOpen,
}: ShortcutBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {shortcuts.slice(0, 5).map((item) => {
        const Icon = item.icon
        const active = item.route === activeRoute

        return (
          <button
            key={item.id}
            onClick={() => item.route && onNavigate?.(item.route)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-4 py-2",
              "min-h-[56px] text-muted-foreground transition-colors active:scale-95",
              active && "text-primary",
            )}
          >
            <Icon className="size-5" />
            <span className="max-w-[56px] truncate text-[10px] leading-tight">
              {item.label}
            </span>
          </button>
        )
      })}

      <button
        onClick={onMenuOpen}
        className="ml-auto flex min-h-[56px] flex-col items-center justify-center gap-0.5 border-l border-border px-4 py-2 text-muted-foreground transition-colors active:scale-95"
      >
        <List className="size-5" />
        <span className="text-[10px] leading-tight">Menu</span>
      </button>
    </nav>
  )
}
