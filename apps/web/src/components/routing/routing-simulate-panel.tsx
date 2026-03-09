import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { simulateRouting } from "@/api/settings";
import type { SimulateRoutingRequest, SimulateRoutingResponse } from "@/api/settings";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RoutingSimulatePanelProps {
  agentId?: string;
}

export function RoutingSimulatePanel({ agentId }: RoutingSimulatePanelProps) {
  const [form, setForm] = useState<SimulateRoutingRequest>({
    agentId,
    mode: "heartbeat",
    estimatedPromptTokens: undefined,
    toolsCount: undefined,
    channelType: undefined,
  });
  const [result, setResult] = useState<SimulateRoutingResponse | null>(null);

  const mutation = useMutation({
    mutationFn: simulateRouting,
    onSuccess: (data) => setResult(data),
  });

  function handleSimulate() {
    mutation.mutate({
      ...form,
      agentId: agentId ?? form.agentId,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Simular Routing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs">Modo</Label>
            <Select
              value={form.mode}
              onValueChange={(v) => { if (v) setForm((f) => ({ ...f, mode: v })); }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["heartbeat", "conversation", "cron", "webhook"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tokens */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tokens estimados</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={form.estimatedPromptTokens ?? ""}
              placeholder="ex: 600"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  estimatedPromptTokens: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </div>

          {/* Tools count */}
          <div className="space-y-1.5">
            <Label className="text-xs">Qtde de tools</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={form.toolsCount ?? ""}
              placeholder="ex: 3"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  toolsCount: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>

          {/* Channel type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Canal</Label>
            <Input
              className="h-8 text-sm"
              value={form.channelType ?? ""}
              placeholder="ex: whatsapp"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  channelType: e.target.value || undefined,
                }))
              }
            />
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleSimulate}
          disabled={mutation.isPending}
          className="w-full"
        >
          <Play className="size-3.5" />
          {mutation.isPending ? "Simulando..." : "Simular"}
        </Button>

        {mutation.isError && (
          <p className="text-xs text-destructive">
            Erro ao simular. Verifique as configuracoes.
          </p>
        )}

        {result && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Resultado</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs">Modelo:</span>
              <code className="text-xs bg-background px-1.5 py-0.5 rounded border font-mono">
                {result.selectedModel}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">Regra:</span>
              {result.fallback ? (
                <Badge variant="secondary" className="text-xs">
                  fallback (sem regra)
                </Badge>
              ) : (
                <Badge variant="default" className="text-xs">
                  {result.matchedRule}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
