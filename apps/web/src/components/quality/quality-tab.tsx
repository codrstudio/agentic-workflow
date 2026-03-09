import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agentQualityQueryOptions, lowRatedQueryOptions } from "@/api/quality";
import { QualityOverviewCards } from "@/components/quality/quality-overview-cards";
import { QualityTrendChart } from "@/components/quality/quality-trend-chart";
import { TopReasonsChart } from "@/components/quality/top-reasons-chart";
import { LowRatedTable } from "@/components/quality/low-rated-table";

const PERIOD_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
] as const;

interface QualityTabProps {
  agentId: string;
  days: number;
}

export function QualityTab({ agentId, days }: QualityTabProps) {
  const navigate = useNavigate();

  const { data: quality, isLoading: qualityLoading } = useQuery(
    agentQualityQueryOptions(agentId, days),
  );
  const { data: lowRated, isLoading: lowRatedLoading } = useQuery(
    lowRatedQueryOptions(agentId),
  );

  function handleDaysChange(d: number) {
    navigate({
      to: "/agents/$id",
      params: { id: agentId },
      search: { tab: "quality" as never, days: d },
      replace: true,
    });
  }

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex items-center gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={days === opt.value ? "default" : "outline"}
            onClick={() => handleDaysChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Overview cards */}
      {qualityLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : quality ? (
        <QualityOverviewCards quality={quality} />
      ) : null}

      {/* Trend chart */}
      {qualityLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : quality ? (
        <QualityTrendChart trend={quality.trend} />
      ) : null}

      {/* Top reasons chart */}
      {qualityLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : quality ? (
        <TopReasonsChart reasons={quality.topReasons} />
      ) : null}

      {/* Low rated table */}
      <LowRatedTable agentId={agentId} items={lowRated ?? []} isLoading={lowRatedLoading} />
    </div>
  );
}
