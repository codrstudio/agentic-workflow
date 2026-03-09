import { Badge } from "@/components/ui/badge";

const statusConfig = {
  active: { label: "Ativo", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20" },
  inactive: { label: "Inativo", className: "bg-muted text-muted-foreground border-border" },
  error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/20" },
  warning: { label: "Alerta", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
} as const;

interface StatusBadgeProps {
  status: keyof typeof statusConfig;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {label ?? config.label}
    </Badge>
  );
}
