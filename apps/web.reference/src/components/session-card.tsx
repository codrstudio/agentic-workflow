import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/hooks/use-sessions";

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export type TemporalGroup = "Hoje" | "Ontem" | "Esta semana" | "Anteriores";

export function getTemporalGroup(iso: string): TemporalGroup {
  const date = new Date(iso);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  if (date >= startOfToday) return "Hoje";
  if (date >= startOfYesterday) return "Ontem";
  if (date >= startOfWeek) return "Esta semana";
  return "Anteriores";
}

const GROUP_ORDER: TemporalGroup[] = ["Hoje", "Ontem", "Esta semana", "Anteriores"];

export function groupSessionsByDate(
  sessions: SessionSummary[],
): { group: TemporalGroup; sessions: SessionSummary[] }[] {
  const groups = new Map<TemporalGroup, SessionSummary[]>();

  for (const session of sessions) {
    const group = getTemporalGroup(session.updated_at);
    const list = groups.get(group) ?? [];
    list.push(session);
    groups.set(group, list);
  }

  return GROUP_ORDER
    .filter((g) => groups.has(g))
    .map((g) => ({ group: g, sessions: groups.get(g)! }));
}

interface SessionCardProps {
  session: SessionSummary;
  onClick?: (session: SessionSummary) => void;
  className?: string;
}

export function SessionCard({ session, onClick, className }: SessionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <MessageSquare className="h-4.5 w-4.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary transition-colors">
            {session.title}
          </h3>
          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
            {session.message_count}
          </Badge>
        </div>

        {session.last_message_preview && (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {session.last_message_preview}
          </p>
        )}

        <span className="mt-1.5 block text-xs text-muted-foreground">
          {formatRelativeDate(session.updated_at)}
        </span>
      </div>
    </button>
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-8 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SessionListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  );
}
