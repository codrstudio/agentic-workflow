import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import type { RoutingRule } from "@/api/settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoutingRuleForm } from "./routing-rule-form.js";

interface RoutingRulesListProps {
  rules: RoutingRule[];
  onChange: (rules: RoutingRule[]) => void;
  disabled?: boolean;
}

function summarizeConditions(cond: RoutingRule["conditions"]): string {
  const parts: string[] = [];
  if (cond.mode) parts.push(`modo=${cond.mode}`);
  if (cond.prompt_tokens_lte !== undefined)
    parts.push(`tokens≤${cond.prompt_tokens_lte}`);
  if (cond.prompt_tokens_gte !== undefined)
    parts.push(`tokens≥${cond.prompt_tokens_gte}`);
  if (cond.tools_count_gte !== undefined)
    parts.push(`tools≥${cond.tools_count_gte}`);
  if (cond.tools_count_lte !== undefined)
    parts.push(`tools≤${cond.tools_count_lte}`);
  if (cond.channel_type) parts.push(`canal=${cond.channel_type}`);
  if (cond.tags_any?.length) parts.push(`tags=${cond.tags_any.join(",")}`);
  return parts.length ? parts.join(", ") : "Sempre";
}

export function RoutingRulesList({
  rules,
  onChange,
  disabled,
}: RoutingRulesListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | undefined>(undefined);

  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  function handleSave(rule: RoutingRule) {
    if (editing) {
      onChange(rules.map((r) => (r.id === rule.id ? rule : r)));
    } else {
      onChange([...rules, rule]);
    }
    setFormOpen(false);
    setEditing(undefined);
  }

  function handleEdit(rule: RoutingRule) {
    setEditing(rule);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    onChange(rules.filter((r) => r.id !== id));
  }

  function handleAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhuma regra configurada. Adicione uma para comecar.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {sorted.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <ArrowUpDown className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {rule.description || rule.id}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    prioridade {rule.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {summarizeConditions(rule.conditions)}
                  </span>
                  <span className="text-xs">→</span>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {rule.model}
                  </code>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleEdit(rule)}
                  disabled={disabled}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(rule.id)}
                  disabled={disabled}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={handleAdd} disabled={disabled}>
        <Plus className="size-4" />
        Adicionar Regra
      </Button>

      <RoutingRuleForm
        open={formOpen}
        initial={editing}
        onSave={handleSave}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
      />
    </div>
  );
}
