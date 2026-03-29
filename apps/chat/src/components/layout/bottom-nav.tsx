import { Link } from "@tanstack/react-router"
import { navItems } from "./nav-config"

export function BottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom,0px)]">
      {navItems.map((item) => {
        const isActive = currentPath === item.href
        return (
          <Link
            key={item.href}
            to={item.href}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 min-h-11 text-xs transition-colors"
            data-active={isActive || undefined}
          >
            <item.icon
              className="size-5 data-[active]:text-primary"
              data-active={isActive || undefined}
            />
            <span
              className="text-muted-foreground data-[active]:text-foreground data-[active]:font-medium"
              data-active={isActive || undefined}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
