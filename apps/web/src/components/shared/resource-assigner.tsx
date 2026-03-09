import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface Resource {
  slug: string;
  name: string;
  description: string;
  source: string;
}

interface ResourceAssignerProps {
  available: Resource[];
  assigned: Resource[];
  onAssign: (slug: string, sourceScope: string) => void;
  onUnassign: (slug: string) => void;
  loading?: boolean;
}

const scopeOrder = ["shared", "system", "agent"] as const;

function classifyScope(source: string): "shared" | "system" | "agent" {
  if (source === "shared") return "shared";
  if (source === "system") return "system";
  return "agent";
}

const scopeLabels: Record<string, string> = {
  shared: "Compartilhado",
  system: "Sistema",
  agent: "Agente",
};

const scopeVariants: Record<string, "secondary" | "outline" | "default"> = {
  shared: "secondary",
  system: "outline",
  agent: "default",
};

export function ResourceAssigner({
  available,
  assigned,
  onAssign,
  onUnassign,
  loading,
}: ResourceAssignerProps) {
  const assignedSlugs = useMemo(
    () => new Set(assigned.map((r) => r.slug)),
    [assigned],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, Resource[]>();
    for (const scope of scopeOrder) {
      groups.set(scope, []);
    }
    for (const item of available) {
      const scope = classifyScope(item.source);
      groups.get(scope)!.push(item);
    }
    return groups;
  }, [available]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          Nenhum recurso disponivel
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scopeOrder.map((scope) => {
        const items = grouped.get(scope);
        if (!items || items.length === 0) return null;
        return (
          <div key={scope} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {scopeLabels[scope]}
            </h4>
            <div className="divide-y rounded-lg border">
              {items.map((item) => {
                const isAssigned = assignedSlugs.has(item.slug);
                return (
                  <div
                    key={`${item.source}-${item.slug}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {item.name || item.slug}
                        </span>
                        <Badge variant={scopeVariants[classifyScope(item.source)]}>
                          {scopeLabels[classifyScope(item.source)]}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={isAssigned}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onAssign(item.slug, item.source);
                        } else {
                          onUnassign(item.slug);
                        }
                      }}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
