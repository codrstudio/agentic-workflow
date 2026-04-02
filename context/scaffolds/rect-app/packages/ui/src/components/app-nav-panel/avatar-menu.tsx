import { cn } from "@ui/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ui/components/ui/popover"
import { Separator } from "@ui/components/ui/separator"
import { Button } from "@ui/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui/components/ui/tooltip"

export interface AvatarUser {
  name: string
  role?: string
  email?: string
  avatarUrl?: string
}

interface AvatarMenuProps {
  user: AvatarUser
  collapsed?: boolean
  theme?: "dark" | "light" | "system"
  onThemeChange?: (theme: "dark" | "light" | "system") => void
  onProfile?: () => void
  onLogout?: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function AvatarMenu({
  user,
  collapsed,
  theme,
  onThemeChange,
  onProfile,
  onLogout,
}: AvatarMenuProps) {
  const trigger = (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "min-h-[44px]",
        collapsed && "justify-center"
      )}
    >
      <Avatar className="size-8 shrink-0">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
        <AvatarFallback className="text-xs">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          {user.role && (
            <div className="truncate text-xs text-muted-foreground">
              {user.role}
            </div>
          )}
        </div>
      )}
    </button>
  )

  const content = (
    <div className="w-64">
      <button
        onClick={onProfile}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent rounded-t-md"
      >
        <Avatar className="size-10 shrink-0">
          {user.avatarUrl && (
            <AvatarImage src={user.avatarUrl} alt={user.name} />
          )}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          {user.role && (
            <div className="truncate text-xs text-muted-foreground">
              {user.role}
            </div>
          )}
          {user.email && (
            <div className="truncate text-xs text-muted-foreground">
              {user.email}
            </div>
          )}
        </div>
      </button>

      <Separator />

      <div className="p-3">
        <div className="mb-2 text-xs text-muted-foreground">Tema</div>
        <div className="flex rounded-md border">
          {(["light", "dark", "system"] as const).map((t) => (
            <Button
              key={t}
              variant={theme === t ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 rounded-none first:rounded-l-md last:rounded-r-md"
              onClick={() => onThemeChange?.(t)}
            >
              {t === "light" ? "Claro" : t === "dark" ? "Escuro" : "Auto"}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="p-1">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          Sair
        </button>
      </div>
    </div>
  )

  if (collapsed) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{user.name}</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="end" className="w-auto p-0">
          {content}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-0">
        {content}
      </PopoverContent>
    </Popover>
  )
}
