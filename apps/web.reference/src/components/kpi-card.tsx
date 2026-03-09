import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
  subtitle?: string;
}

export function KpiCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  subtitle,
}: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-md p-2", iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function KpiCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="h-[88px] animate-pulse rounded-lg border bg-muted" />
  );
}
