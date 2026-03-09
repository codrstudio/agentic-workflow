import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Gauge, AlertTriangle, PauseCircle } from "lucide-react";
import { agentsQueryOptions } from "@/api/agents";
import { quotaQueryOptions } from "@/api/quotas";
import type { AgentQuota } from "@/api/quotas";

interface AgentQuotaRow {
  agentId: string;
  slug: string;
  quota: AgentQuota;
}

function AgentQuotaItem({ row }: { row: AgentQuotaRow }) {
  const isPaused = row.quota.status === "paused_quota";
  const hourlyPct = row.quota.usage.hourly.pctUsed ?? 0;
  const dailyPct = row.quota.usage.daily.pctUsed ?? 0;
  const maxPct = Math.max(hourlyPct, dailyPct);

  return (
    <Link
      to="/agents/$id"
      params={{ id: row.agentId }}
      search={{ tab: "quotas" } as never}
      className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted transition-colors text-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        {isPaused ? (
          <PauseCircle className="size-4 shrink-0 text-destructive" />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
        )}
        <span className="truncate font-medium">{row.slug}</span>
      </div>
      <span
        className={
          isPaused
            ? "text-destructive font-semibold"
            : "text-amber-600 dark:text-amber-400 font-semibold"
        }
      >
        {isPaused ? "Pausado" : `${Math.round(maxPct)}%`}
      </span>
    </Link>
  );
}

function AgentQuotaLoader({ agentId, slug }: { agentId: string; slug: string }) {
  const { data: quota } = useQuery({ ...quotaQueryOptions(agentId), retry: false });

  if (!quota) return null;

  const isPaused = quota.status === "paused_quota";
  const hourlyPct = quota.usage.hourly.pctUsed ?? 0;
  const dailyPct = quota.usage.daily.pctUsed ?? 0;
  const needsAlert = isPaused || hourlyPct >= 80 || dailyPct >= 80;

  if (!needsAlert) return null;

  return <AgentQuotaItem row={{ agentId, slug, quota }} />;
}

export function QuotaAlertWidget() {
  const { data: agents } = useQuery(agentsQueryOptions());

  const enabledAgents = agents?.filter((a) => a.enabled) ?? [];

  if (enabledAgents.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Gauge className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Alertas de quota</h3>
      </div>
      <div className="p-2 space-y-0.5 min-h-[60px]">
        {enabledAgents.map((agent) => (
          <AgentQuotaLoader key={agent.id} agentId={agent.id} slug={agent.slug} />
        ))}
        <p className="text-xs text-muted-foreground px-3 py-2 italic">
          Agentes com consumo &gt; 80% ou pausados aparecem aqui.
        </p>
      </div>
    </div>
  );
}
