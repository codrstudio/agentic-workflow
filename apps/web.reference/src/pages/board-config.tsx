import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2, GripVertical, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBoardConfig,
  usePatchBoardConfig,
  type BoardColumn,
} from "@/hooks/use-board";
import { useSprints } from "@/hooks/use-sprints";

// --- Default columns for Restore Defaults ---

const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: "a-fazer", label: "A fazer", status_filter: ["pending"], color: "#e0f2fe" },
  { id: "backlog", label: "Backlog", status_filter: ["pending", "blocked"], color: "#f3f4f6" },
  { id: "em-progresso", label: "Em progresso", status_filter: ["in_progress"], color: "#fef9c3" },
  { id: "revisao", label: "Revisão", status_filter: ["failing"], color: "#fee2e2" },
  { id: "concluido", label: "Concluído", status_filter: ["passing"], color: "#dcfce7" },
  { id: "pulado", label: "Pulado", status_filter: ["skipped"], color: "#f5f5f5" },
];

const DEFAULT_ROUTING_RULES: { condition: string; assignee: string }[] = [
  { condition: "default", assignee: "agent" },
];

const ASSIGNEE_OPTIONS = ["agent", "human", "pending", "paused"] as const;

// --- Editable column row ---

interface ColumnRowProps {
  column: BoardColumn;
  onChange: (updated: BoardColumn) => void;
  onRemove: () => void;
}

function ColumnRow({ column, onChange, onRemove }: ColumnRowProps) {
  const [statusInput, setStatusInput] = useState("");

  const addStatus = () => {
    const trimmed = statusInput.trim();
    if (!trimmed || column.status_filter.includes(trimmed)) return;
    onChange({ ...column, status_filter: [...column.status_filter, trimmed] });
    setStatusInput("");
  };

  const removeStatus = (s: string) => {
    const filtered = column.status_filter.filter((sf) => sf !== s);
    if (filtered.length === 0) return; // must have at least 1
    onChange({ ...column, status_filter: filtered });
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border p-3">
      <GripVertical className="size-4 text-muted-foreground mt-1.5 shrink-0 cursor-grab" />

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={column.label}
            onChange={(e) => onChange({ ...column, label: e.target.value })}
            placeholder="Label"
            className="rounded border bg-background px-2 py-1 text-sm flex-1"
          />
          <input
            type="color"
            value={column.color ?? "#f3f4f6"}
            onChange={(e) => onChange({ ...column, color: e.target.value })}
            className="rounded border size-8 cursor-pointer p-0.5"
          />
          <input
            type="number"
            value={column.wip_limit ?? ""}
            onChange={(e) =>
              onChange({
                ...column,
                wip_limit: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            placeholder="WIP"
            className="rounded border bg-background px-2 py-1 text-sm w-16"
            min={1}
          />
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Status:</span>
          {column.status_filter.map((sf) => (
            <span
              key={sf}
              className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
            >
              {sf}
              <button
                onClick={() => removeStatus(sf)}
                className="hover:text-red-600 ml-0.5"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            type="text"
            value={statusInput}
            onChange={(e) => setStatusInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStatus()}
            placeholder="+ status"
            className="rounded border bg-background px-1.5 py-0.5 text-[11px] w-20"
          />
        </div>
      </div>

      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-red-600 mt-1"
        title="Remover coluna"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// --- Routing rule row ---

interface RuleRowProps {
  rule: { condition: string; assignee: string };
  onChange: (updated: { condition: string; assignee: string }) => void;
  onRemove: () => void;
}

function RuleRow({ rule, onChange, onRemove }: RuleRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2.5">
      <GripVertical className="size-4 text-muted-foreground shrink-0 cursor-grab" />
      <input
        type="text"
        value={rule.condition}
        onChange={(e) => onChange({ ...rule, condition: e.target.value })}
        placeholder="condition (e.g. default, has_label:X, priority=high)"
        className="rounded border bg-background px-2 py-1 text-sm flex-1"
      />
      <select
        value={rule.assignee}
        onChange={(e) => onChange({ ...rule, assignee: e.target.value })}
        className="rounded border bg-background px-2 py-1 text-sm"
      >
        {ASSIGNEE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-red-600"
        title="Remover regra"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// --- Main BoardConfigPanel page ---

export function BoardConfigPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const search = useSearch({ strict: false }) as { sprint?: string };
  const navigate = useNavigate();

  const { data: sprints } = useSprints(projectId);
  const latestSprint = sprints?.[sprints.length - 1]?.number ?? 1;
  const currentSprint = search.sprint ? Number(search.sprint) : latestSprint;

  const { data: boardConfig, isLoading } = useBoardConfig(projectId, currentSprint);
  const patchConfig = usePatchBoardConfig(projectId);

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [rules, setRules] = useState<{ condition: string; assignee: string }[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync local state when remote data loads
  useEffect(() => {
    if (boardConfig) {
      setColumns(boardConfig.columns.map((c) => ({ ...c })));
      setRules(boardConfig.routing_rules.map((r) => ({ ...r })));
      setDirty(false);
    }
  }, [boardConfig]);

  const updateColumn = (index: number, updated: BoardColumn) => {
    setColumns((prev) => prev.map((c, i) => (i === index ? updated : c)));
    setDirty(true);
  };

  const removeColumn = (index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const addColumn = () => {
    const id = `col-${Date.now()}`;
    setColumns((prev) => [
      ...prev,
      { id, label: "Nova coluna", status_filter: ["pending"], color: "#f3f4f6" },
    ]);
    setDirty(true);
  };

  const updateRule = (index: number, updated: { condition: string; assignee: string }) => {
    setRules((prev) => prev.map((r, i) => (i === index ? updated : r)));
    setDirty(true);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const addRule = () => {
    setRules((prev) => [...prev, { condition: "default", assignee: "agent" }]);
    setDirty(true);
  };

  const handleSave = () => {
    patchConfig.mutate(
      { sprint: currentSprint, patch: { columns, routing_rules: rules } },
      { onSuccess: () => setDirty(false) },
    );
  };

  const handleRestoreDefaults = () => {
    setColumns(DEFAULT_COLUMNS.map((c) => ({ ...c })));
    setRules(DEFAULT_ROUTING_RULES.map((r) => ({ ...r })));
    setDirty(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              navigate({
                to: "/projects/$projectId/harness/board",
                params: { projectId },
                search: { sprint: String(currentSprint) },
              } as any)
            }
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold">Board Config — Sprint {currentSprint}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestoreDefaults}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <RotateCcw className="size-4" />
            Restaurar Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || patchConfig.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              dirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Save className="size-4" />
            {patchConfig.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          Carregando configuração...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-2xl">
          {/* Columns section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Colunas</h2>
              <button
                onClick={addColumn}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="size-3.5" />
                Adicionar coluna
              </button>
            </div>
            <div className="space-y-2">
              {columns.map((col, i) => (
                <ColumnRow
                  key={col.id}
                  column={col}
                  onChange={(updated) => updateColumn(i, updated)}
                  onRemove={() => removeColumn(i)}
                />
              ))}
            </div>
          </section>

          {/* Routing rules section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Regras de Routing
              </h2>
              <button
                onClick={addRule}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="size-3.5" />
                Adicionar regra
              </button>
            </div>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <RuleRow
                  key={i}
                  rule={rule}
                  onChange={(updated) => updateRule(i, updated)}
                  onRemove={() => removeRule(i)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Condições: <code>default</code>, <code>has_label:X</code>, <code>priority=X</code>,{" "}
              <code>complexity &gt; N</code>, <code>has_dep</code>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
