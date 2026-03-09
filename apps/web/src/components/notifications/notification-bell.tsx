import { useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { pendingApprovalsQueryOptions } from "@/api/approvals";
import { Bell, AlertCircle, AlertTriangle, Info, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  notificationsQueryOptions,
  notificationCountQueryOptions,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "@/api/notifications";
import { useSSEEvent, type SystemEvent } from "@/hooks/use-sse";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const severityIcon: Record<string, { icon: typeof AlertCircle; className: string }> = {
  error: { icon: AlertCircle, className: "text-destructive" },
  warning: { icon: AlertTriangle, className: "text-yellow-500" },
  info: { icon: Info, className: "text-blue-500" },
};

function getNavigationTarget(n: Notification): string | null {
  if (n.agentId && n.type.startsWith("heartbeat")) return `/agents/${n.agentId}`;
  if (n.type.startsWith("job_")) return "/jobs" as string;
  if (n.type.startsWith("cron_")) return "/cron";
  return null;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: countData } = useQuery(notificationCountQueryOptions());
  const { data: recentData } = useQuery(
    notificationsQueryOptions({ limit: 5 }),
  );

  const unread = countData?.unread ?? 0;
  const notifications = recentData?.rows ?? [];

  const { data: pendingApprovals } = useQuery(pendingApprovalsQueryOptions());
  const hasPendingApprovals = (pendingApprovals?.length ?? 0) > 0;

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useSSEEvent(
    "notification:new",
    useCallback(
      (event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });

        const severity = event.data?.severity as string | undefined;
        const title = event.data?.title as string | undefined;
        if (severity === "error" && title) {
          toast.error(title);
        }
      },
      [queryClient],
    ),
  );

  function handleNotificationClick(n: Notification) {
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    const target = getNavigationTarget(n);
    if (target) {
      navigate({ to: target as string });
    }
  }

  function handleMarkAll() {
    markAllMutation.mutate();
  }

  const bellButton = (
    <Button variant="ghost" size="icon" aria-label="Notificacoes" className="relative">
      <Bell className="h-4 w-4" />
      {(unread > 0 || hasPendingApprovals) && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unread > 99 ? "99+" : unread > 0 ? unread : "!"}
        </span>
      )}
    </Button>
  );

  if (hasPendingApprovals) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Aprovacoes pendentes"
        className="relative"
        onClick={() => navigate({ to: "/approvals" as string })}
      >
        <Bell className="h-4 w-4" />
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          !
        </span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={bellButton} />
      <DropdownMenuContent align="end" sideOffset={8} className="w-80">
        <DropdownMenuLabel>Notificacoes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificacao
          </div>
        ) : (
          notifications.map((n) => {
            const sev = severityIcon[n.severity] ?? severityIcon.info!;
            const Icon = sev.icon;
            return (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-2.5 px-3 py-2"
                onClick={() => handleNotificationClick(n)}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.className}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{n.title}</span>
                    {!n.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {n.agentId && <span className="truncate">{n.agentId}</span>}
                    <span className="shrink-0">{timeAgo(n.ts)}</span>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-3 py-1.5">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: "/notifications" as string })}
          >
            Ver todas
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
