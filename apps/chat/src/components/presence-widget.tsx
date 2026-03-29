import { useNavigate } from "@tanstack/react-router"
import {
  ChatCircle,
  Queue as QueueIcon,
  Headset,
} from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { PresenceStatus } from "@/lib/hooks/use-presence"
import type { PresenceTeamMember } from "@workspace/types"

const STATUS_CONFIG: Record<
  PresenceStatus,
  { label: string; color: string; dotClass: string; badge?: string; badgeClass?: string }
> = {
  online: {
    label: "Online",
    color: "text-green-600 dark:text-green-400",
    dotClass: "bg-green-500",
    badge: "Chat ativo",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  paused: {
    label: "Ausente",
    color: "text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
    badge: "Pausado",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  offline: {
    label: "Offline",
    color: "text-gray-400 dark:text-gray-500",
    dotClass: "bg-gray-400",
  },
}

interface PresenceWidgetProps {
  status: PresenceStatus
  queueSize: number
  myChats: string[]
  onlineTeam: PresenceTeamMember[]
  collapsed?: boolean
  onStatusChange: (status: PresenceStatus) => void
}

export function PresenceWidget({
  status,
  queueSize,
  myChats,
  onlineTeam,
  collapsed = false,
  onStatusChange,
}: PresenceWidgetProps) {
  const navigate = useNavigate()
  const config = STATUS_CONFIG[status]
  const isActive = status !== "offline"

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => navigate({ to: "/chat" as "/" })}
              className="flex flex-col items-center gap-0.5 rounded-md p-2 hover:bg-accent transition-colors w-full"
            >
              <span className={`size-2.5 rounded-full ${config.dotClass}`} />
              {queueSize > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {queueSize}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{config.label}</p>
            {myChats.length > 0 && <p>{myChats.length} chat(s) ativo(s)</p>}
            {queueSize > 0 && <p>{queueSize} na fila</p>}
            {onlineTeam.length > 0 && <p>{onlineTeam.length} na equipe</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* ── Header: status dropdown (toda a barra é clicável) ── */}
      <StatusDropdown
        status={status}
        config={config}
        onStatusChange={onStatusChange}
      />

      {/* ── Body: only visible when online or paused ── */}
      {isActive && (
        <>
          {/* Meus Chats */}
          <div className="border-t border-border px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ChatCircle className="size-3.5" />
              <span className="font-medium text-foreground">Meus Chats</span>
            </div>
            <p className="mt-0.5 pl-5 text-[11px] text-muted-foreground">
              {myChats.length === 0
                ? "Nenhum chat ativo"
                : `${myChats.length} chat(s) ativo(s)`}
            </p>
          </div>

          {/* Fila + Total ativo */}
          <div className="border-t border-border px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <QueueIcon className="size-3.5" />
                <span className="font-medium text-foreground">Fila</span>
              </span>
              <span className="text-muted-foreground">{queueSize}</span>
            </div>
            <div className="flex items-center justify-between text-xs pl-5">
              <span className="text-muted-foreground">Total ativo</span>
              <span className="font-semibold text-foreground">{myChats.length}</span>
            </div>
          </div>

          {/* Equipe online */}
          <div className="border-t border-border px-2.5 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Headset className="size-3.5" />
                <span className="font-medium text-foreground">Equipe online</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                {onlineTeam.length}
              </span>
            </div>
            {onlineTeam.length > 0 && (
              <ul className="mt-1 pl-5 space-y-0.5">
                {onlineTeam.map((member) => (
                  <li key={member.userId} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className={`size-1.5 rounded-full ${
                        member.status === "online" ? "bg-green-500" : "bg-amber-500"
                      }`}
                    />
                    {member.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatusDropdown({
  status,
  config,
  onStatusChange,
}: {
  status: PresenceStatus
  config: (typeof STATUS_CONFIG)[PresenceStatus]
  onStatusChange: (status: PresenceStatus) => void
}) {
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full p-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${config.color}`}>
                  <span className={`size-2.5 rounded-full ${config.dotClass}`} />
                  {config.label}
                </span>
                {config.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${config.badgeClass}`}>
                    {config.badge}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Alterar status de presenca</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onStatusChange("online")} disabled={status === "online"}>
          <span className="size-2 rounded-full bg-green-500" />
          Online
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onStatusChange("paused")} disabled={status === "paused"}>
          <span className="size-2 rounded-full bg-amber-500" />
          Ausente
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onStatusChange("offline")} disabled={status === "offline"}>
          <span className="size-2 rounded-full bg-gray-400" />
          Offline
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
