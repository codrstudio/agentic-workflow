import { useState, useMemo } from "react";
import {
  Download,
  Filter,
  Clock,
  User,
  Bot,
  Cpu,
  FileDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useComplianceDecisions,
  useComplianceExport,
  type ComplianceDecisionLog,
  type ActorType,
  type DecisionType,
} from "@/hooks/use-compliance";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  feature_approved: "Aprovado",
  feature_rejected: "Rejeitado",
  review_completed: "Review",
  sign_off_granted: "Sign-off",
  origin_reclassified: "Reclassificado",
  quality_gate_passed: "QG Passou",
  quality_gate_failed: "QG Falhou",
  escalation_resolved: "Escalação",
};

const DECISION_TYPE_COLORS: Record<DecisionType, string> = {
  feature_approved:
    "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
  feature_rejected:
    "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  review_completed:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
  sign_off_granted:
    "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20",
  origin_reclassified:
    "bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20",
  quality_gate_passed:
    "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20",
  quality_gate_failed:
    "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  escalation_resolved:
    "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
};

const ACTOR_CONFIG: Record<
  ActorType,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  human: {
    label: "Humano",
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    Icon: User,
  },
  system: {
    label: "Sistema",
    className:
      "bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-500/20",
    Icon: Cpu,
  },
  agent: {
    label: "Agente",
    className:
      "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
    Icon: Bot,
  },
};

const ACTOR_OPTIONS: Array<{ value: ActorType | "all"; label: string }> = [
  { value: "all", label: "Todos os actores" },
  { value: "human", label: "Humano" },
  { value: "system", label: "Sistema" },
  { value: "agent", label: "Agente" },
];

const DECISION_TYPE_OPTIONS: Array<{
  value: DecisionType | "all";
  label: string;
}> = [
  { value: "all", label: "Todos os tipos" },
  { value: "feature_approved", label: "Aprovado" },
  { value: "feature_rejected", label: "Rejeitado" },
  { value: "review_completed", label: "Review" },
  { value: "sign_off_granted", label: "Sign-off" },
  { value: "origin_reclassified", label: "Reclassificado" },
  { value: "quality_gate_passed", label: "QG Passou" },
  { value: "quality_gate_failed", label: "QG Falhou" },
  { value: "escalation_resolved", label: "Escalação" },
];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(
  decisions: ComplianceDecisionLog[]
): Array<{ day: string; dayLabel: string; events: ComplianceDecisionLog[] }> {
  const map = new Map<string, ComplianceDecisionLog[]>();
  for (const d of decisions) {
    const day = d.created_at.slice(0, 10);
    const arr = map.get(day) ?? [];
    arr.push(d);
    map.set(day, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, events]) => ({
      day,
      dayLabel: formatDate(`${day}T00:00:00`),
      events,
    }));
}

// ----------------------------------------------------------------
// Actor Badge
// ----------------------------------------------------------------

function ActorBadge({ actor }: { actor: ActorType }) {
  const cfg = ACTOR_CONFIG[actor] ?? ACTOR_CONFIG.system;
  const { Icon } = cfg;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        cfg.className
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ----------------------------------------------------------------
// Decision Type Badge
// ----------------------------------------------------------------

function DecisionTypeBadge({ type }: { type: DecisionType }) {
  const label = DECISION_TYPE_LABELS[type] ?? type;
  const className = DECISION_TYPE_COLORS[type] ?? "";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
    >
      {label}
    </span>
  );
}

// ----------------------------------------------------------------
// Timeline Event Item
// ----------------------------------------------------------------

function TimelineItem({ event }: { event: ComplianceDecisionLog }) {
  return (
    <div className="flex gap-4">
      {/* Vertical line connector */}
      <div className="flex flex-col items-center">
        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <DecisionTypeBadge type={event.decision_type} />
          <ActorBadge actor={event.actor} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(event.created_at)}
          </span>
        </div>
        {(event.target_id ?? event.details) && (
          <div className="mt-1.5 space-y-0.5">
            {event.target_id && (
              <p className="truncate text-xs text-muted-foreground">
                Alvo: {event.target_type ? `${event.target_type}/` : ""}
                {event.target_id}
              </p>
            )}
            {event.details && (
              <p className="text-xs text-foreground/70">{event.details}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Decision Timeline
// ----------------------------------------------------------------

export function DecisionTimeline({ projectId }: { projectId: string }) {
  const [actorFilter, setActorFilter] = useState<ActorType | "all">("all");
  const [typeFilter, setTypeFilter] = useState<DecisionType | "all">("all");

  const { data, isLoading } = useComplianceDecisions(projectId, { limit: 50 });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.decisions.filter((d) => {
      if (actorFilter !== "all" && d.actor !== actorFilter) return false;
      if (typeFilter !== "all" && d.decision_type !== typeFilter) return false;
      return true;
    });
  }, [data, actorFilter, typeFilter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value as ActorType | "all")}
          className="rounded-md border bg-background px-2.5 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ACTOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as DecisionType | "all")
          }
          className="rounded-md border bg-background px-2.5 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DECISION_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {data && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} de {data.decisions.length} eventos
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <Skeleton className="mt-1 h-2 w-2 rounded-full" />
                <Skeleton className="mt-1 w-px flex-1" />
              </div>
              <Skeleton className="mb-4 h-10 flex-1 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && grouped.length === 0 && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Nenhum evento encontrado com os filtros selecionados
        </div>
      )}

      {/* Grouped timeline */}
      {!isLoading &&
        grouped.map((group) => (
          <div key={group.day}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.dayLabel}
            </p>
            <div>
              {group.events.map((event, idx) => (
                <div
                  key={event.id}
                  className={idx === group.events.length - 1 ? "[&_.w-px]:hidden" : ""}
                >
                  <TimelineItem event={event} />
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Compliance Export Dialog
// ----------------------------------------------------------------

const CONTENT_OPTIONS = [
  { id: "snapshot", label: "Compliance Snapshot" },
  { id: "decision_logs", label: "Decision Logs" },
  { id: "ip_report", label: "IP Attribution Report" },
  { id: "artifact_origins", label: "Artifact Origins" },
  { id: "review_summaries", label: "Review Summaries" },
] as const;

type ContentKey = (typeof CONTENT_OPTIONS)[number]["id"];
type ExportFormat = "json" | "zip";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function ComplianceExportDialog({
  projectId,
  trigger,
}: {
  projectId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(nDaysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [format, setFormat] = useState<ExportFormat>("json");
  const [selected, setSelected] = useState<Set<ContentKey>>(
    new Set(CONTENT_OPTIONS.map((o) => o.id))
  );

  const exportMutation = useComplianceExport(projectId);

  function toggleContent(key: ContentKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleGenerate() {
    exportMutation.mutate(
      { from, to, format },
      {
        onSuccess: (data) => {
          const dataObj = data as unknown as Record<string, unknown>;
          const filtered: Record<string, unknown> = {};
          for (const key of selected) {
            if (key in dataObj) {
              filtered[key] = dataObj[key];
            }
          }
          const exportData = {
            ...(dataObj.export_metadata
              ? { export_metadata: dataObj.export_metadata }
              : {}),
            ...filtered,
          };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `compliance-export-${from}-${to}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setOpen(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted"
          >
            <FileDown className="h-3.5 w-3.5" />
            Exportar
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Compliance Bundle</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          {/* Date range */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-from" className="text-xs text-muted-foreground">
                  De
                </Label>
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-to" className="text-xs text-muted-foreground">
                  Até
                </Label>
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Content checkboxes */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Conteúdo</Label>
            <div className="flex flex-col gap-2.5">
              {CONTENT_OPTIONS.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`export-${opt.id}`}
                    checked={selected.has(opt.id)}
                    onCheckedChange={() => toggleContent(opt.id)}
                  />
                  <Label
                    htmlFor={`export-${opt.id}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Formato</Label>
            <div className="flex gap-3">
              {(["json", "zip"] as ExportFormat[]).map((f) => (
                <label
                  key={f}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    format === f
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="sr-only"
                  />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
            {format === "zip" && (
              <p className="text-xs text-muted-foreground">
                ZIP exporta como JSON compactado (mesmo conteúdo).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={exportMutation.isPending || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportMutation.isPending ? "Gerando..." : "Gerar e Baixar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
