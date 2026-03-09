interface QuotaGaugeProps {
  label: string;
  used: number;
  total: number | null;
  pctUsed: number | null;
  unit?: string;
}

export function QuotaGauge({ label, used, total, pctUsed, unit }: QuotaGaugeProps) {
  const pct = pctUsed ?? 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;

  const color =
    pct >= 100
      ? "text-destructive stroke-destructive"
      : pct >= 80
        ? "text-amber-500 stroke-amber-500"
        : "text-primary stroke-primary";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-28">
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className="stroke-muted"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={total === null ? circumference : offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold leading-none">
            {total === null ? "—" : `${Math.round(pct)}%`}
          </span>
          {total !== null && (
            <span className="text-xs text-muted-foreground mt-0.5">
              {used.toLocaleString()}
              {unit ? ` ${unit}` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {total !== null && (
          <p className="text-xs text-muted-foreground">
            limite: {total.toLocaleString()}
            {unit ? ` ${unit}` : ""}
          </p>
        )}
        {total === null && (
          <p className="text-xs text-muted-foreground">sem limite</p>
        )}
      </div>
    </div>
  );
}
