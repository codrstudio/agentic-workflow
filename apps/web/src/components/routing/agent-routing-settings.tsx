import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { agentFileQueryOptions, saveAgentFile } from "@/api/agents";
import type { RoutingRule } from "@/api/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { RoutingRulesList } from "./routing-rules-list.js";
import { RoutingSimulatePanel } from "./routing-simulate-panel.js";

// Parse routing section from AGENT.yml content (YAML-like frontmatter)
function parseRoutingFromYaml(content: string): {
  enabled: boolean;
  rules: RoutingRule[];
} {
  // Very simple YAML extraction — just look for routing: block
  try {
    // Look for "routing:" section and parse basic structure
    const match = content.match(/^routing:\s*\n((?:[ \t]+.*\n?)*)/m);
    if (!match) return { enabled: false, rules: [] };

    const block = match[1];
    const enabledMatch = block.match(/^\s+enabled:\s*(true|false)/m);
    const enabled = enabledMatch ? enabledMatch[1] === "true" : false;

    // Rules are stored as JSON array in a comment for simplicity
    // Actual parsing via backbone — here we just read the stored JSON blob
    const rulesMatch = block.match(/^\s+rules_json:\s*'([^']*)'/m);
    const rules: RoutingRule[] = rulesMatch
      ? JSON.parse(rulesMatch[1])
      : [];

    return { enabled, rules };
  } catch {
    return { enabled: false, rules: [] };
  }
}

// Serialize routing section into YAML lines
function serializeRoutingToYaml(
  content: string,
  enabled: boolean,
  rules: RoutingRule[],
): string {
  const block = `routing:\n  enabled: ${enabled}\n  rules_json: '${JSON.stringify(rules).replace(/'/g, "\\'")}'\n`;

  if (/^routing:\s*\n((?:[ \t]+.*\n?)*)/m.test(content)) {
    return content.replace(/^routing:\s*\n((?:[ \t]+.*\n?)*)/m, block);
  }
  return content.trimEnd() + "\n" + block;
}

interface AgentRoutingSettingsProps {
  agentId: string;
}

export function AgentRoutingSettings({ agentId }: AgentRoutingSettingsProps) {
  const queryClient = useQueryClient();

  // Read AGENT.yml
  const { data: fileContent, isLoading } = useQuery(
    agentFileQueryOptions(agentId, "AGENT.yml"),
  );

  const [overrideEnabled, setOverrideEnabled] = useState<boolean | null>(null);
  const [rules, setRules] = useState<RoutingRule[] | null>(null);

  const rawContent = fileContent?.content ?? "";
  const parsed = fileContent
    ? parseRoutingFromYaml(rawContent)
    : { enabled: false, rules: [] as RoutingRule[] };

  const effectiveEnabled = overrideEnabled ?? parsed.enabled;
  const effectiveRules = rules ?? parsed.rules;

  const isDirty = overrideEnabled !== null || rules !== null;

  const saveMutation = useMutation({
    mutationFn: () => {
      const newContent = serializeRoutingToYaml(
        rawContent,
        effectiveEnabled,
        effectiveRules,
      );
      return saveAgentFile(agentId, "AGENT.yml", newContent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agents", agentId, "file", "AGENT.yml"],
      });
      setOverrideEnabled(null);
      setRules(null);
      toast.success("Configuracoes de routing salvas");
    },
    onError: () => toast.error("Erro ao salvar configuracoes de routing"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle override */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-sm font-medium">Override de regras globais</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Regras abaixo tem prioridade sobre as regras globais para este agente.
          </p>
        </div>
        <Switch
          checked={effectiveEnabled}
          onCheckedChange={(v) => setOverrideEnabled(v)}
        />
      </div>

      {/* Agent rules */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Regras do Agente</h3>
          <p className="text-xs text-muted-foreground">
            Aplicadas somente a este agente, com prioridade maior que as regras globais.
          </p>
        </div>
        <RoutingRulesList
          rules={effectiveRules}
          onChange={(r) => setRules(r)}
          disabled={!effectiveEnabled}
        />
      </div>

      {isDirty && (
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      )}

      <Separator />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Simular Routing</h3>
          <p className="text-xs text-muted-foreground">
            Teste qual modelo seria selecionado para este agente.
          </p>
        </div>
        <RoutingSimulatePanel agentId={agentId} />
      </div>
    </div>
  );
}
