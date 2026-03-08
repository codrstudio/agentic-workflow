import { useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Kanban, Settings, Wand2, ChevronDown, Loader2, Bot, User, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBoardView,
  useMoveFeature,
  useAutoRoute,
  type FeatureWithMeta,
  type BoardColumnView,
} from "@/hooks/use-board";
import { useSprints } from "@/hooks/use-sprints";

// --- Priority badge ---

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium,
      )}
    >
      {priority}
    </span>
  );
}

// --- Assignee badge ---

function AssigneeBadge({ assignee }: { assignee: string }) {
  if (assignee === "agent") {
    return (
      <span title="Agent" className="text-violet-600 dark:text-violet-400">
        <Bot className="size-4" />
      </span>
    );
  }
  if (assignee === "human") {
    return (
      <span title="Human" className="text-emerald-600 dark:text-emerald-400">
        <User className="size-4" />
      </span>
    );
  }
  return (
    <span title="Pending" className="text-muted-foreground">
      <HelpCircle className="size-4" />
    </span>
  );
}

// --- Status live badge ---

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  passing: { label: "Passing", className: "text-green-700 dark:text-green-400" },
  failing: { label: "Failing", className: "text-red-700 dark:text-red-400" },
  in_progress: { label: "Executando...", className: "text-blue-700 dark:text-blue-400" },
  pending: { label: "Pending", className: "text-gray-500" },
  blocked: { label: "Blocked", className: "text-orange-600 dark:text-orange-400" },
  skipped: { label: "Skipped", className: "text-yellow-600 dark:text-yellow-400" },
};

// --- FeatureCard ---

interface FeatureCardProps {
  feature: FeatureWithMeta;
  isDragging?: boolean;
  onClick?: () => void;
}

function FeatureCard({ feature, isDragging, onClick }: FeatureCardProps) {
  const meta = feature.board_meta;
  const statusCfg = (STATUS_LABELS[feature.status] ?? STATUS_LABELS["pending"])!;
  const visibleLabels = meta.labels.slice(0, 2);

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-pointer transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/40",
      )}
    >
      {/* Header: Feature ID + Assignee */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono font-bold text-muted-foreground">
          {feature.id}
        </span>
        <AssigneeBadge assignee={meta.assignee} />
      </div>

      {/* Body: title truncated 2 lines */}
      <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
        {feature.name}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={meta.priority} />

        {visibleLabels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {label}
          </span>
        ))}

        {meta.actual_cost_usd != null && (
          <span className="text-[10px] font-mono text-muted-foreground">
            ${meta.actual_cost_usd.toFixed(2)}
          </span>
        )}

        {feature.status === "in_progress" ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 className="size-3 animate-spin" />
            Executando...
          </span>
        ) : (
          <span className={cn("ml-auto text-[11px] font-medium", statusCfg.className)}>
            {statusCfg.label}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Draggable card wrapper ---

function DraggableFeatureCard({
  feature,
  onClick,
}: {
  feature: FeatureWithMeta;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: feature.id,
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <FeatureCard feature={feature} isDragging={isDragging} onClick={onClick} />
    </div>
  );
}

// --- Droppable column ---

interface KanbanColumnProps {
  column: BoardColumnView;
  onCardClick: (feature: FeatureWithMeta) => void;
}

function KanbanColumn({ column, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const count = column.features.length;
  const wipExceeded = column.wip_limit != null && count > column.wip_limit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col shrink-0 w-72 rounded-xl border",
        isOver && "ring-2 ring-primary/30",
      )}
      style={{ backgroundColor: column.color ?? "#f9fafb" }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{column.label}</span>
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full px-1.5 text-xs font-bold min-w-[20px]",
              wipExceeded
                ? "bg-red-600 text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        </div>
        {column.wip_limit != null && (
          <span
            className={cn(
              "text-[10px] font-medium",
              wipExceeded ? "text-red-600 font-bold" : "text-muted-foreground",
            )}
          >
            WIP: {count}/{column.wip_limit}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto min-h-[80px] flex-1">
        {column.features.map((f) => (
          <DraggableFeatureCard
            key={f.id}
            feature={f}
            onClick={() => onCardClick(f)}
          />
        ))}
      </div>
    </div>
  );
}

// --- Feature Detail Panel (slide-over) ---

interface FeatureDetailPanelProps {
  feature: FeatureWithMeta;
  onClose: () => void;
}

function FeatureDetailPanel({ feature, onClose }: FeatureDetailPanelProps) {
  const meta = feature.board_meta;
  const statusCfg = (STATUS_LABELS[feature.status] ?? STATUS_LABELS["pending"])!;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      {/* Panel */}
      <div className="relative ml-auto w-[400px] bg-background border-l shadow-xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-muted-foreground">
              {feature.id}
            </span>
            <h2 className="text-base font-semibold mt-0.5">{feature.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg px-2"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status */}
          <div>
            <span className="text-xs text-muted-foreground">Status</span>
            <div className={cn("text-sm font-medium mt-0.5", statusCfg.className)}>
              {feature.status === "in_progress" ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3.5 animate-spin" /> Executando...
                </span>
              ) : (
                statusCfg.label
              )}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <span className="text-xs text-muted-foreground">Assignee</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <AssigneeBadge assignee={meta.assignee} />
              <span className="text-sm capitalize">{meta.assignee}</span>
            </div>
          </div>

          {/* Priority */}
          <div>
            <span className="text-xs text-muted-foreground">Priority</span>
            <div className="mt-0.5">
              <PriorityBadge priority={meta.priority} />
            </div>
          </div>

          {/* Labels */}
          {meta.labels.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Labels</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {meta.labels.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cost */}
          {(meta.estimated_cost_usd != null || meta.actual_cost_usd != null) && (
            <div>
              <span className="text-xs text-muted-foreground">Custo</span>
              <p className="text-sm mt-0.5">
                {meta.estimated_cost_usd != null && (
                  <span>Estimado: ${meta.estimated_cost_usd.toFixed(2)}</span>
                )}
                {meta.estimated_cost_usd != null && meta.actual_cost_usd != null && " | "}
                {meta.actual_cost_usd != null && (
                  <span>Real: ${meta.actual_cost_usd.toFixed(2)}</span>
                )}
              </p>
            </div>
          )}

          {/* Dependencies */}
          {feature.dependencies.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Dependências</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {feature.dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tests */}
          {feature.tests.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Testes ({feature.tests.length})</span>
              <ul className="mt-0.5 space-y-1">
                {feature.tests.map((t, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          <div>
            <span className="text-xs text-muted-foreground">Descrição</span>
            <p className="text-sm mt-0.5 text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Auto-Routing Dialog ---

function AutoRoutingDialog({
  projectSlug,
  sprint,
  onClose,
}: {
  projectSlug: string;
  sprint: number;
  onClose: () => void;
}) {
  const autoRoute = useAutoRoute(projectSlug);
  const [result, setResult] = useState<{ feature_id: string; assignee: string }[] | null>(null);

  const handleApply = () => {
    autoRoute.mutate(
      { sprint },
      {
        onSuccess: (data) => {
          setResult(data.routed);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-lg border shadow-xl w-[420px] max-h-[70vh] overflow-y-auto p-5">
        <h3 className="text-base font-semibold mb-3">Auto-Routing</h3>

        {result ? (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {result.length} feature(s) roteadas.
            </p>
            <ul className="space-y-1 mb-4">
              {result.map((r) => (
                <li key={r.feature_id} className="text-sm">
                  <span className="font-mono font-bold">{r.feature_id}</span>{" "}
                  → <span className="capitalize">{r.assignee}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onClose}
              className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Aplicar regras de routing automático para features com assignee pendente.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={autoRoute.isPending}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {autoRoute.isPending ? "Aplicando..." : "Aplicar Routing"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main AgenticBoard page ---

export function AgenticBoardPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const search = useSearch({ strict: false }) as { sprint?: string };
  const navigate = useNavigate();

  const { data: sprints } = useSprints(projectId);
  const latestSprint = sprints?.[sprints.length - 1]?.number ?? 1;
  const currentSprint = search.sprint ? Number(search.sprint) : latestSprint;

  const { data: boardView, isLoading } = useBoardView(projectId, currentSprint);
  const moveFeature = useMoveFeature(projectId);

  const [activeFeature, setActiveFeature] = useState<FeatureWithMeta | null>(null);
  const [detailFeature, setDetailFeature] = useState<FeatureWithMeta | null>(null);
  const [showAutoRouting, setShowAutoRouting] = useState(false);

  // Build a lookup map for features across all columns
  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureWithMeta>();
    boardView?.columns.forEach((col) =>
      col.features.forEach((f) => map.set(f.id, f)),
    );
    return map;
  }, [boardView]);

  // Find which column a feature belongs to
  const findColumnForFeature = useCallback(
    (featureId: string): string | undefined => {
      return boardView?.columns.find((col) =>
        col.features.some((f) => f.id === featureId),
      )?.id;
    },
    [boardView],
  );

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const feat = featureMap.get(event.active.id as string);
    setActiveFeature(feat ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveFeature(null);

    const { active, over } = event;
    if (!over) return;

    const featureId = active.id as string;
    const targetColumnId = over.id as string;
    const sourceColumnId = findColumnForFeature(featureId);

    if (!sourceColumnId || sourceColumnId === targetColumnId) return;

    // Optimistic update handled by mutation + invalidation
    moveFeature.mutate(
      {
        feature_id: featureId,
        sprint: currentSprint,
        target_column_id: targetColumnId,
      },
      {
        onError: () => {
          // Revert is automatic via query invalidation + refetch
        },
      },
    );
  };

  const handleSprintChange = (sprint: number) => {
    navigate({
      search: { sprint: String(sprint) },
      replace: true,
    } as any);
  };

  const sprintOptions = sprints?.map((s) => s.number) ?? [currentSprint];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Kanban className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Board — Sprint {currentSprint}</h1>

          {/* Sprint selector */}
          <div className="relative">
            <select
              value={currentSprint}
              onChange={(e) => handleSprintChange(Number(e.target.value))}
              className="appearance-none rounded-md border bg-background px-3 py-1.5 pr-7 text-sm"
            >
              {sprintOptions.map((n) => (
                <option key={n} value={n}>
                  Sprint {n}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAutoRouting(true)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Wand2 className="size-4" />
            Auto-Routing
          </button>
          <button
            onClick={() =>
              navigate({
                to: "/projects/$projectId/settings",
                params: { projectId },
              } as any)
            }
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Settings className="size-4" />
            Configurar Board
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" />
          Carregando board...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-4 overflow-x-auto flex-1 items-start">
            {boardView?.columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                onCardClick={(f) => setDetailFeature(f)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeFeature && (
              <div className="w-72">
                <FeatureCard feature={activeFeature} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Feature Detail Panel */}
      {detailFeature && (
        <FeatureDetailPanel
          feature={detailFeature}
          onClose={() => setDetailFeature(null)}
        />
      )}

      {/* Auto-Routing Dialog */}
      {showAutoRouting && (
        <AutoRoutingDialog
          projectSlug={projectId}
          sprint={currentSprint}
          onClose={() => setShowAutoRouting(false)}
        />
      )}
    </div>
  );
}
