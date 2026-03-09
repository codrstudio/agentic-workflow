import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  usePipelineHealth,
  useResetCircuitBreaker,
  usePipelineHealthSSE,
  type PipelineStatus,
  type StepStatus,
  type StepHealth,
  type PipelineStep,
  type CircuitBreaker,
} from "@/hooks/use-pipeline-health";

// ---- Helpers ----

function statusColor(status: PipelineStatus): string {
  switch (status) {
    case "healthy":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
    case "degraded":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    case "unhealthy":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
    case "stopped":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30";
  }
}

function statusDot(status: PipelineStatus): string {
  switch (status) {
    case "healthy":
      return "bg-green-500";
    case "degraded":
      return "bg-yellow-500";
    case "unhealthy":
      return "bg-red-500";
    case "stopped":
      return "bg-slate-500";
  }
}

function stepStatusIcon(status: StepStatus, health: StepHealth) {
  if (status === "circuit_broken")
    return <Zap className="h-4 w-4 text-orange-500" />;
  if (status === "running")
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "failed" || health === "dead")
    return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === "skipped")
    return <SkipForward className="h-4 w-4 text-muted-foreground" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function stepRowBg(status: StepStatus): string {
  if (status === "failed") return "border-red-500/40 bg-red-500/5";
  if (status === "circuit_broken") return "border-orange-500/40 bg-orange-500/5";
  if (status === "running") return "border-blue-500/40 bg-blue-500/5";
  if (status === "completed") return "border-green-500/20 bg-green-500/5";
  return "border-border bg-background";
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---- Step row ----

function StepRow({ step }: { step: PipelineStep }) {
  const isFailing = step.status === "failed" || step.status === "circuit_broken";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex items-start gap-3 transition-colors",
        stepRowBg(step.status)
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        {stepStatusIcon(step.status, step.health)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">
            Step {step.step_number}: {step.task}
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
            {step.retries > 0 && (
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-yellow-700 dark:text-yellow-400">
                {step.retries} retry
              </span>
            )}
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {formatDuration(step.duration_seconds)}
            </span>
          </div>
        </div>
        {isFailing && step.last_error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-mono line-clamp-2">
            {step.last_error}
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Circuit Breaker Card ----

interface CircuitBreakerCardProps {
  cb: CircuitBreaker;
  projectId: string;
}

function CircuitBreakerCard({ cb, projectId }: CircuitBreakerCardProps) {
  const reset = useResetCircuitBreaker(projectId);

  const isTripped = cb.triggered;
  const failurePct = Math.min(100, (cb.consecutive_failures / cb.threshold) * 100);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col gap-3",
        isTripped
          ? "border-orange-500/40 bg-orange-500/5"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap
            className={cn(
              "h-5 w-5",
              isTripped ? "text-orange-500" : "text-muted-foreground"
            )}
          />
          <span className="font-semibold text-sm">Circuit Breaker</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            isTripped
              ? "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400"
              : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
          )}
        >
          {isTripped ? "TRIPPED" : "ACTIVE"}
        </span>
      </div>

      {/* Failures bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Failures</span>
          <span>
            {cb.consecutive_failures} / {cb.threshold}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              failurePct >= 100
                ? "bg-red-500"
                : failurePct >= 66
                  ? "bg-orange-500"
                  : failurePct >= 33
                    ? "bg-yellow-500"
                    : "bg-green-500"
            )}
            style={{ width: `${failurePct}%` }}
          />
        </div>
      </div>

      {isTripped && cb.trigger_reason && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Reason: </span>
          {cb.trigger_reason}
        </p>
      )}

      {isTripped && cb.triggered_at && (
        <p className="text-xs text-muted-foreground">
          Triggered at {formatDateTime(cb.triggered_at)}
        </p>
      )}

      <Button
        size="sm"
        variant={isTripped ? "default" : "outline"}
        disabled={reset.isPending}
        onClick={() => reset.mutate()}
        className="w-full gap-1.5"
      >
        {reset.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Reset Circuit Breaker
      </Button>

      {reset.isSuccess && (
        <p className="text-xs text-center text-green-600 dark:text-green-400">
          Circuit breaker reset successfully
        </p>
      )}
    </div>
  );
}

// ---- Event Timeline ----

type TimelineEvent = {
  time: string;
  type: string;
  label: string;
  color: string;
};

function buildTimeline(
  steps: PipelineStep[],
  cb: CircuitBreaker
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (cb.triggered && cb.triggered_at) {
    events.push({
      time: cb.triggered_at,
      type: "circuit-broken",
      label: `Circuit broken: ${cb.trigger_reason ?? "threshold reached"}`,
      color: "text-orange-500",
    });
  }

  for (const step of steps) {
    if (step.status === "running") {
      events.push({
        time: new Date().toISOString(),
        type: "started",
        label: `Step ${step.step_number} (${step.task}) started`,
        color: "text-blue-500",
      });
    } else if (step.status === "completed") {
      events.push({
        time: new Date().toISOString(),
        type: "completed",
        label: `Step ${step.step_number} (${step.task}) completed in ${formatDuration(step.duration_seconds)}`,
        color: "text-green-500",
      });
    } else if (step.status === "failed") {
      events.push({
        time: new Date().toISOString(),
        type: "failed",
        label: `Step ${step.step_number} (${step.task}) failed`,
        color: "text-red-500",
      });
    }
    if (step.retries > 0) {
      events.push({
        time: new Date().toISOString(),
        type: "retried",
        label: `Step ${step.step_number} retried ${step.retries}x`,
        color: "text-yellow-500",
      });
    }
  }

  return events.slice(0, 10);
}

function timelineIcon(type: string) {
  switch (type) {
    case "started":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500" />;
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "circuit-broken":
      return <Zap className="h-3.5 w-3.5 text-orange-500" />;
    case "retried":
      return <RefreshCw className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ---- Main Page ----

export function PipelineHealthDashboardPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/pipeline/health",
  });

  const [wave, _setWave] = useState<number | undefined>(undefined);

  const { data: health, isLoading, isError, error } = usePipelineHealth(projectId, wave);

  // Subscribe to SSE for realtime updates
  usePipelineHealthSSE(projectId);

  const timeline = health
    ? buildTimeline(health.steps, health.circuit_breaker)
    : [];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline Health</h1>
            {health && (
              <p className="text-sm text-muted-foreground">
                Wave {health.wave} · checked {formatDateTime(health.checked_at)}
              </p>
            )}
          </div>
        </div>

        {health && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold capitalize",
              statusColor(health.status)
            )}
          >
            <span
              className={cn("h-2 w-2 rounded-full", statusDot(health.status))}
            />
            {health.status}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Failed to load pipeline health: {error?.message}
        </div>
      )}

      {health && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: Steps + Timeline */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Live stepper */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-muted-foreground" />
                Steps
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  live via SSE
                </span>
              </h2>
              {health.steps.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No steps found for this wave.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {health.steps.map((step) => (
                  <StepRow key={step.step_number} step={step} />
                ))}
              </div>
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Recent Events
                </h2>
                <ol className="flex flex-col gap-2">
                  {timeline.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex-shrink-0">
                        {timelineIcon(ev.type)}
                      </span>
                      <span className={cn("flex-1", ev.color)}>
                        {ev.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Right: Circuit Breaker */}
          <div className="flex flex-col gap-4">
            <CircuitBreakerCard
              cb={health.circuit_breaker}
              projectId={projectId}
            />

            {/* Summary stats */}
            <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-background p-3 text-center">
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {health.steps.filter((s) => s.status === "completed").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-md border bg-background p-3 text-center">
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {health.steps.filter((s) => s.status === "failed").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="rounded-md border bg-background p-3 text-center">
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {health.steps.filter((s) => s.status === "running").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Running</p>
                </div>
                <div className="rounded-md border bg-background p-3 text-center">
                  <p className="text-xl font-bold text-muted-foreground">
                    {health.steps.reduce((acc, s) => acc + s.retries, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Retries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
