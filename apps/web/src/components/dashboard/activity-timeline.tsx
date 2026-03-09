import { useState } from "react";
import { Activity, Calendar, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/api/dashboard";

type ActivityEvent = DashboardData["recentActivity"][number];
type EventType = ActivityEvent["type"];

const typeConfig: Record<EventType, { icon: typeof Activity; label: string }> = {
  heartbeat: { icon: Activity, label: "Heartbeat" },
  cron: { icon: Calendar, label: "Cron" },
  conversation: { icon: MessageSquare, label: "Conversa" },
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "secondary",
  error: "destructive",
  skipped: "outline",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const PREVIEW_MAX = 80;

function EventPreview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > PREVIEW_MAX;

  return (
    <button
      type="button"
      className={cn(
        "mt-1 text-left text-xs text-muted-foreground",
        truncated && !expanded && "cursor-pointer hover:text-foreground",
      )}
      onClick={truncated ? () => setExpanded((v) => !v) : undefined}
      disabled={!truncated}
    >
      {expanded || !truncated ? text : `${text.slice(0, PREVIEW_MAX)}...`}
    </button>
  );
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

const filterTypes: EventType[] = ["heartbeat", "cron", "conversation"];

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<EventType | null>(null);

  const filtered = activeFilter
    ? events.filter((e) => e.type === activeFilter)
    : events;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Atividade Recente</h3>
          <div className="flex gap-1">
            {filterTypes.map((type) => {
              const cfg = typeConfig[type];
              const Icon = cfg.icon;
              const isActive = activeFilter === type;
              return (
                <Button
                  key={type}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setActiveFilter(isActive ? null : type)}
                >
                  <Icon className="size-3" />
                  {cfg.label}
                </Button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma atividade recente
          </p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            {filtered.map((event, i) => {
              const cfg = typeConfig[event.type];
              const Icon = cfg.icon;
              const variant = statusVariant[event.status] ?? "outline";
              return (
                <div key={`${event.ts}-${i}`} className="relative flex gap-3 py-2 pl-0">
                  <div className="relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full bg-background border">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {event.agentId}
                      </span>
                      <Badge variant={variant} className="shrink-0">
                        {event.status}
                      </Badge>
                      {event.slug && (
                        <span className="text-xs text-muted-foreground truncate">
                          {event.slug}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {timeAgo(event.ts)}
                      </span>
                    </div>
                    {event.preview && <EventPreview text={event.preview} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
