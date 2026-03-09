import {
  Headphones,
  ShoppingCart,
  LifeBuoy,
  Monitor,
  User,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentTemplate } from "@/api/templates";

const ICON_MAP: Record<string, LucideIcon> = {
  Headphones,
  ShoppingCart,
  LifeBuoy,
  Monitor,
  User,
  Bot,
};

interface TemplateCardProps {
  template: AgentTemplate;
  onSelect: () => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const Icon = ICON_MAP[template.icon] ?? Bot;

  return (
    <Card className="flex flex-col transition-colors hover:ring-1 hover:ring-foreground/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5 shrink-0 text-muted-foreground" />
          {template.name}
        </CardTitle>
        <CardDescription>
          <Badge variant="secondary" className="mb-1 mt-0.5 text-xs">
            {template.category}
          </Badge>
        </CardDescription>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {template.description}
        </p>
      </CardHeader>
      <CardContent className="mt-auto pt-2">
        <Button size="sm" className="w-full" onClick={onSelect}>
          Usar este template
        </Button>
      </CardContent>
    </Card>
  );
}
