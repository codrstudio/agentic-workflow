import {
  Clock,
  Coins,
  Cpu,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Trace } from "@/api/traces";

const typeLabels: Record<Trace["type"], string> = {
  heartbeat: "Heartbeat",
  conversation: "Conversa",
  cron: "Cron",
};

const typeColors: Record<Trace["type"], string> = {
  heartbeat:
    "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  conversation:
    "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  cron: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = Math.floor(secs % 60);
  return `${mins}m ${remSecs}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface TraceHeaderProps {
  trace: Trace;
}

export function TraceHeader({ trace }: TraceHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={typeColors[trace.type]}>
          {typeLabels[trace.type]}
        </Badge>
        <span className="text-sm text-muted-foreground">#{trace.id}</span>
        <span className="text-sm text-muted-foreground">{trace.agentId}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricItem
          icon={<Clock className="size-4" />}
          label="Duracao"
          value={formatDuration(trace.durationMs)}
        />
        <MetricItem
          icon={<Coins className="size-4" />}
          label="Custo"
          value={formatCost(trace.costUsd)}
        />
        <MetricItem
          icon={<ArrowDownToLine className="size-4" />}
          label="Tokens in"
          value={formatTokens(trace.totalTokensIn)}
        />
        <MetricItem
          icon={<ArrowUpFromLine className="size-4" />}
          label="Tokens out"
          value={formatTokens(trace.totalTokensOut)}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className="size-3.5" />
        <span>{trace.model}</span>
        <span>·</span>
        <span>{new Date(trace.startedAt).toLocaleString("pt-BR")}</span>
        <span>·</span>
        <span>{trace.steps.length} steps</span>
      </div>
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
