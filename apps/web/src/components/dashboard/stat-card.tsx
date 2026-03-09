import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: "ok" | "warning" | "error";
  href?: string;
}

const statusRing: Record<string, string> = {
  ok: "ring-emerald-500/30",
  warning: "ring-amber-500/40",
  error: "ring-destructive/40",
};

const statusIcon: Record<string, string> = {
  ok: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-destructive",
};

export function StatCard({ title, value, subtitle, icon: Icon, status = "ok", href }: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        href && "cursor-pointer",
        status && statusRing[status],
      )}
    >
      <CardContent className="flex items-start gap-3">
        <div className={cn("rounded-lg bg-muted p-2", status && statusIcon[status])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link to={href}>{card}</Link>;
  }

  return card;
}
