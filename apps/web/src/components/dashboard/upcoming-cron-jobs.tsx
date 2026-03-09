import { Link } from "@tanstack/react-router";
import { Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@/api/dashboard";

type CronJob = DashboardData["cronJobs"]["nextRuns"][number];

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "agora";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `em ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `em ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `em ${hours}h`;
  const days = Math.floor(hours / 24);
  return `em ${days}d`;
}

interface UpcomingCronJobsProps {
  jobs: CronJob[];
}

export function UpcomingCronJobs({ jobs }: UpcomingCronJobsProps) {
  const upcoming = jobs.slice(0, 5);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Proximos Cron Jobs</h3>
          <Link
            to="/cron"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum cron job agendado
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((job) => (
              <div
                key={`${job.agentId}-${job.slug}`}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                <Badge variant="outline" className="shrink-0 font-normal">
                  {job.agentId}
                </Badge>
                <span className="min-w-0 truncate text-sm">{job.slug}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {timeUntil(job.nextRun)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
