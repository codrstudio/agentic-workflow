import { Check, Loader2 } from "lucide-react";
import type { LlmPlan } from "@/api/settings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LlmPlanCardProps {
  plan: LlmPlan;
  isActive: boolean;
  onActivate: (name: string) => void;
  isLoading?: boolean;
}

const roleLabels: Record<string, string> = {
  conversation: "Conversa",
  heartbeat: "Heartbeat",
  memory: "Memoria",
};

function formatModelName(model: string) {
  const parts = model.split("/");
  return parts.length > 1 ? parts[1] : model;
}

export function LlmPlanCard({
  plan,
  isActive,
  onActivate,
  isLoading,
}: LlmPlanCardProps) {
  return (
    <Card
      className={cn(
        "transition-colors",
        isActive && "ring-2 ring-primary",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {plan.title}
          {isActive && <Badge variant="default">Ativo</Badge>}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Modelos por role
          </p>
          <div className="grid gap-1">
            {Object.entries(plan.roles).map(([role, slugName]) => {
              const slug = plan.slugs[slugName];
              return (
                <div
                  key={role}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {roleLabels[role] ?? role}
                  </span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {slug ? formatModelName(slug.llm.model) : slugName}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          size="sm"
          variant={isActive ? "outline" : "default"}
          disabled={isActive || isLoading}
          onClick={() => onActivate(plan.name)}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isActive ? (
            <>
              <Check className="size-4" />
              Plano ativo
            </>
          ) : (
            "Ativar este plano"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
