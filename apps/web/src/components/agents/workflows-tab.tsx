import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GitBranch, ExternalLink, Bot } from "lucide-react";
import { agentWorkflowsQueryOptions } from "@/api/workflows";
import type { Workflow, WorkflowNode } from "@/api/workflows";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkflowsTabProps {
  agentId: string;
}

function getAgentRole(wf: Workflow, agentId: string): "Entrada" | "Destino" | "Intermediario" {
  const agentNodes = wf.nodes.filter((n: WorkflowNode) => n.agentId === agentId);

  // If any node is marked as entry, role is Entrada
  if (agentNodes.some((n) => n.isEntry)) return "Entrada";

  const targetNodeIds = new Set(wf.edges.map((e) => e.to));
  const sourceNodeIds = new Set(wf.edges.map((e) => e.from));

  for (const node of agentNodes) {
    const isTarget = targetNodeIds.has(node.id);
    const isSource = sourceNodeIds.has(node.id);
    // If receives edges but doesn't send any, it's a destination
    if (isTarget && !isSource) return "Destino";
  }

  return "Intermediario";
}

const ROLE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  Entrada: { label: "Entrada", variant: "default" },
  Destino: { label: "Destino", variant: "secondary" },
  Intermediario: { label: "Intermediário", variant: "outline" },
};

export function WorkflowsTab({ agentId }: WorkflowsTabProps) {
  const { data: workflows, isLoading } = useQuery(agentWorkflowsQueryOptions(agentId));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!workflows || workflows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
        <GitBranch className="h-8 w-8 opacity-40" />
        <div>
          <p className="text-sm font-medium">Este agente nao participa de nenhum workflow</p>
          <p className="mt-1 text-xs">
            Crie ou edite um workflow em{" "}
            <Link to="/workflows" className="text-primary underline underline-offset-2">
              Workflows
            </Link>{" "}
            e adicione este agente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Workflows em que este agente participa ({workflows.length})
      </p>
      {workflows.map((wf) => {
        const role = getAgentRole(wf, agentId);
        const badge = ROLE_BADGE[role]!;
        return (
          <div
            key={wf.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-shadow hover:shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{wf.label}</span>
                <Badge variant={badge.variant} className="shrink-0 text-[10px] px-1.5 py-0">
                  {badge.label}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {wf.nodes.length} {wf.nodes.length === 1 ? "agente" : "agentes"} &middot; v{wf.version}
              </p>
            </div>
            <Link
              to="/workflows/$id"
              params={{ id: wf.id }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">Abrir canvas</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
