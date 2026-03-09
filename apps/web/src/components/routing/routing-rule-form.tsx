import { useState } from "react";
import type { RoutingRule, RoutingConditions } from "@/api/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODES = ["heartbeat", "conversation", "cron", "webhook"] as const;
const CHANNEL_TYPES = ["whatsapp", "email", "http", "sse"] as const;

const POPULAR_MODELS = [
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-opus-4-6",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5",
  "google/gemini-pro-1.5",
  "google/gemini-2.0-flash",
  "meta-llama/llama-3.3-70b-instruct",
];

interface RoutingRuleFormProps {
  open: boolean;
  initial?: RoutingRule;
  onSave: (rule: RoutingRule) => void;
  onClose: () => void;
}

function emptyRule(): RoutingRule {
  return {
    id: crypto.randomUUID().slice(0, 8),
    description: "",
    conditions: {},
    model: "anthropic/claude-haiku-4-5",
    priority: 10,
  };
}

export function RoutingRuleForm({
  open,
  initial,
  onSave,
  onClose,
}: RoutingRuleFormProps) {
  const [rule, setRule] = useState<RoutingRule>(initial ?? emptyRule());
  const [customModel, setCustomModel] = useState(
    !POPULAR_MODELS.includes(rule.model) ? rule.model : "",
  );
  const [useCustomModel, setUseCustomModel] = useState(
    !POPULAR_MODELS.includes(rule.model),
  );

  function setCond<K extends keyof RoutingConditions>(
    key: K,
    value: RoutingConditions[K] | "",
  ) {
    setRule((r) => {
      const next = { ...r.conditions };
      if (value === "" || value === undefined) {
        delete next[key];
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return { ...r, conditions: next };
    });
  }

  function handleSave() {
    const finalModel = useCustomModel ? customModel.trim() : rule.model;
    if (!finalModel) return;
    onSave({ ...rule, model: finalModel });
  }

  const cond = rule.conditions;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Regra" : "Nova Regra"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name / description */}
          <div className="space-y-1.5">
            <Label>Nome / Descricao</Label>
            <Input
              value={rule.description ?? ""}
              onChange={(e) => setRule((r) => ({ ...r, description: e.target.value }))}
              placeholder="Ex: heartbeats simples"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Prioridade (maior = mais prioritario)</Label>
            <Input
              type="number"
              min={1}
              value={rule.priority}
              onChange={(e) =>
                setRule((r) => ({ ...r, priority: Number(e.target.value) }))
              }
            />
          </div>

          {/* Conditions */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Condicoes (todos os campos sao opcionais)</p>

            {/* Mode */}
            <div className="space-y-1.5">
              <Label>Modo</Label>
              <Select
                value={cond.mode ?? ""}
                onValueChange={(v) => setCond("mode", !v || v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Qualquer modo</SelectItem>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Token range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tokens estimados &le;</Label>
                <Input
                  type="number"
                  min={0}
                  value={cond.prompt_tokens_lte ?? ""}
                  placeholder="ex: 800"
                  onChange={(e) =>
                    setCond(
                      "prompt_tokens_lte",
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tokens estimados &ge;</Label>
                <Input
                  type="number"
                  min={0}
                  value={cond.prompt_tokens_gte ?? ""}
                  placeholder="ex: 2000"
                  onChange={(e) =>
                    setCond(
                      "prompt_tokens_gte",
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                />
              </div>
            </div>

            {/* Tools count */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tools &ge;</Label>
                <Input
                  type="number"
                  min={0}
                  value={cond.tools_count_gte ?? ""}
                  placeholder="ex: 5"
                  onChange={(e) =>
                    setCond(
                      "tools_count_gte",
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tools &le;</Label>
                <Input
                  type="number"
                  min={0}
                  value={cond.tools_count_lte ?? ""}
                  placeholder="ex: 3"
                  onChange={(e) =>
                    setCond(
                      "tools_count_lte",
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                />
              </div>
            </div>

            {/* Channel type */}
            <div className="space-y-1.5">
              <Label>Tipo de canal</Label>
              <Select
                value={cond.channel_type ?? ""}
                onValueChange={(v) =>
                  setCond("channel_type", !v || v === "_none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Qualquer canal</SelectItem>
                  {CHANNEL_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label>Tags (separadas por virgula)</Label>
              <Input
                value={(cond.tags_any ?? []).join(", ")}
                placeholder="ex: urgent, vip"
                onChange={(e) => {
                  const tags = e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  setCond("tags_any", tags.length ? tags : "");
                }}
              />
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label>Modelo a usar</Label>
            {!useCustomModel ? (
              <div className="flex gap-2">
                <Select
                  value={rule.model}
                  onValueChange={(v) => { if (v) setRule((r) => ({ ...r, model: v })); }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POPULAR_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseCustomModel(true)}
                >
                  Outro
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="provider/model-id"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUseCustomModel(false);
                    setRule((r) => ({ ...r, model: "anthropic/claude-haiku-4-5" }));
                  }}
                >
                  Lista
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Regra</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
