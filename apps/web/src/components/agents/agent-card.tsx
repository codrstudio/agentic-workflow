import { Activity, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Agent, AgentStats } from "@/api/agents";

export interface HeartbeatLive {
  status: string;
  preview?: string;
}

export interface CircuitBreakerLive {
  killSwitch: boolean;
  tripped: boolean;
}

interface AgentCardProps {
  agent: Agent;
  stats?: AgentStats;
  heartbeatLive?: HeartbeatLive;
  circuitBreaker?: CircuitBreakerLive;
  onToggle: (id: string, enabled: boolean) => void;
  onClick: () => void;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

function formatCost(value?: number): string {
  if (value == null) return "—";
  return `US$ ${value.toFixed(4)}`;
}

export function AgentCard({
  agent,
  stats,
  heartbeatLive,
  circuitBreaker,
  onToggle,
  onClick,
}: AgentCardProps) {
  const isActive = agent.enabled && agent.heartbeatEnabled;

  let CbIcon: typeof ShieldCheck | null = null;
  let cbClass = "";
  let cbTitle = "";
  if (circuitBreaker?.killSwitch) {
    CbIcon = ShieldX;
    cbClass = "text-red-500";
    cbTitle = "Kill-switch ativo";
  } else if (circuitBreaker?.tripped) {
    CbIcon = ShieldAlert;
    cbClass = "text-yellow-500";
    cbTitle = "Circuit-breaker disparado";
  } else if (circuitBreaker !== undefined) {
    CbIcon = ShieldCheck;
    cbClass = "text-green-500";
    cbTitle = "Circuit-breaker OK";
  }

  return (
    <Card
      className={`cursor-pointer transition-colors hover:ring-foreground/20 ${circuitBreaker?.killSwitch ? "ring-2 ring-red-500/40" : ""}`}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity
            className={`size-4 shrink-0 ${heartbeatLive ? "animate-pulse text-green-500" : "text-muted-foreground"}`}
          />
          {agent.slug}
          {CbIcon && (
            <CbIcon className={`size-3.5 shrink-0 ml-auto ${cbClass}`} title={cbTitle} />
          )}
        </CardTitle>
        <CardAction>
          <Switch
            size="sm"
            checked={agent.enabled}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            onCheckedChange={(checked) => onToggle(agent.id, checked)}
          />
        </CardAction>
        <CardDescription className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {agent.owner}
          </Badge>
          <StatusBadge status={isActive ? "active" : "inactive"} />
          {circuitBreaker?.killSwitch && (
            <Badge variant="destructive" className="text-xs">PARADO</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Ultima atividade: {formatRelativeTime(stats?.lastTimestamp)}</span>
          <span>{formatCost(stats?.totalCostUsd)}</span>
        </div>
      </CardContent>
      {heartbeatLive?.preview && (
        <CardFooter>
          <p className="truncate text-xs text-muted-foreground">
            {heartbeatLive.preview}
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
