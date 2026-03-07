import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  X,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  GitBranch,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useLatestSnapshot,
  useGenerateSnapshot,
  type ProjectSnapshot,
  type SnapshotSession,
  type SnapshotArtifact,
  type SnapshotReview,
} from "@/hooks/use-snapshots";
import { useResumeBannerStore } from "@/stores/resume-banner.store";
import { useSessions } from "@/hooks/use-sessions";

const INACTIVITY_THRESHOLD_HOURS = 4;

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 60) return `${diffMin}min atras`;
  if (diffHours < 24) return `${diffHours}h atras`;
  if (diffDays === 1) return "ontem";
  return `${diffDays} dias atras`;
}

interface CollapsibleSectionProps {
  title: string;
  icon: typeof FileText;
  count: number;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon: Icon, count, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div className="border-t border-border/50 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2 py-1.5",
          "hover:bg-accent/50 transition-colors text-sm",
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{title}</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {count}
          </Badge>
        </div>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="mt-1 pl-8 space-y-1">{children}</div>}
    </div>
  );
}

function SessionsList({ sessions }: { sessions: SnapshotSession[] }) {
  return (
    <>
      {sessions.map((s) => (
        <div key={s.id} className="flex items-start justify-between text-xs py-1">
          <div className="flex-1 min-w-0">
            <span className="font-medium truncate block">{s.title}</span>
            {s.key_topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {s.key_topics.slice(0, 3).map((topic, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
                    {topic.length > 40 ? topic.slice(0, 37) + "..." : topic}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <span className="text-muted-foreground ml-2 shrink-0">
            {formatRelativeDate(s.created_at)}
          </span>
        </div>
      ))}
    </>
  );
}

function ArtifactsList({ artifacts }: { artifacts: SnapshotArtifact[] }) {
  return (
    <>
      {artifacts.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">{a.title}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
              {a.type}
            </Badge>
          </div>
          <span className="text-muted-foreground ml-2 shrink-0">
            {formatRelativeDate(a.updated_at)}
          </span>
        </div>
      ))}
    </>
  );
}

function ReviewsList({ reviews }: { reviews: SnapshotReview[] }) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    in_review: "bg-blue-100 text-blue-700",
    changes_requested: "bg-red-100 text-red-700",
  };

  return (
    <>
      {reviews.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs py-1">
          <span className="font-medium truncate">{r.title}</span>
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 shrink-0",
              statusColors[r.status] ?? "bg-gray-100 text-gray-700",
            )}
          >
            {r.status}
          </Badge>
        </div>
      ))}
    </>
  );
}

function SprintSection({ sprint }: { sprint: ProjectSnapshot["active_sprint"] }) {
  if (!sprint) return null;

  const total = sprint.features_total;
  const passingPct = total > 0 ? (sprint.features_passing / total) * 100 : 0;
  const failingPct = total > 0 ? (sprint.features_failing / total) * 100 : 0;
  const pendingPct = total > 0 ? (sprint.features_pending / total) * 100 : 0;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Sprint {sprint.number} — {sprint.current_phase}</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {passingPct > 0 && (
          <div className="bg-green-500 transition-all" style={{ width: `${passingPct}%` }} />
        )}
        {failingPct > 0 && (
          <div className="bg-red-500 transition-all" style={{ width: `${failingPct}%` }} />
        )}
        {pendingPct > 0 && (
          <div className="bg-gray-400 transition-all" style={{ width: `${pendingPct}%` }} />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">
          {sprint.features_passing} passing
        </Badge>
        <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
          {sprint.features_failing} failing
        </Badge>
        <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0">
          {sprint.features_pending} pending
        </Badge>
      </div>
    </div>
  );
}

interface ResumeBannerProps {
  projectSlug: string;
}

export function ResumeBanner({ projectSlug }: ResumeBannerProps) {
  const navigate = useNavigate();
  const { data: snapshot, isLoading, isError } = useLatestSnapshot(projectSlug);
  const { data: sessions } = useSessions(projectSlug);
  const generateSnapshot = useGenerateSnapshot(projectSlug);
  const { dismiss, isDismissed } = useResumeBannerStore();

  // Check if banner was dismissed recently
  if (isDismissed(projectSlug, INACTIVITY_THRESHOLD_HOURS)) return null;

  // Don't show while loading or on error (404 = no snapshot yet)
  if (isLoading || isError || !snapshot) return null;

  // Check if last session was > 4h ago
  const lastSessionDate = sessions
    ?.map((s) => new Date(s.updated_at).getTime())
    .sort((a, b) => b - a)[0];

  if (lastSessionDate) {
    const hoursSinceLastSession = (Date.now() - lastSessionDate) / (1000 * 60 * 60);
    if (hoursSinceLastSession < INACTIVITY_THRESHOLD_HOURS) return null;
  }

  // If no sessions exist at all, check snapshot created_at
  if (!lastSessionDate) {
    const snapshotAge = (Date.now() - new Date(snapshot.created_at).getTime()) / (1000 * 60 * 60);
    if (snapshotAge < INACTIVITY_THRESHOLD_HOURS) return null;
  }

  const handleResume = () => {
    navigate({
      to: "/projects/$projectId/chat",
      params: { projectId: projectSlug },
    });
  };

  const handleDismiss = () => {
    dismiss(projectSlug);
  };

  const handleRefresh = () => {
    generateSnapshot.mutate();
  };

  return (
    <div
      className={cn(
        "mx-4 mt-3 sm:mx-6 rounded-lg border bg-muted/50 animate-in fade-in duration-500",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-semibold">Onde voce parou</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary */}
      <div className="px-4 pb-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{snapshot.summary}</p>
      </div>

      {/* Collapsible sections */}
      <div className="px-4 pb-2 space-y-1">
        <CollapsibleSection
          title="Sessoes recentes"
          icon={MessageSquare}
          count={snapshot.recent_sessions.length}
        >
          <SessionsList sessions={snapshot.recent_sessions} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Artifacts atualizados"
          icon={FileText}
          count={snapshot.recent_artifacts.length}
        >
          <ArtifactsList artifacts={snapshot.recent_artifacts} />
        </CollapsibleSection>

        {snapshot.active_sprint && (
          <CollapsibleSection
            title="Sprint ativo"
            icon={GitBranch}
            count={1}
          >
            <SprintSection sprint={snapshot.active_sprint} />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="Reviews pendentes"
          icon={ClipboardCheck}
          count={snapshot.pending_reviews.length}
        >
          <ReviewsList reviews={snapshot.pending_reviews} />
        </CollapsibleSection>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <Button size="sm" onClick={handleResume} className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Retomar chat
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={generateSnapshot.isPending}
          className="gap-1.5"
        >
          {generateSnapshot.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Atualizar
        </Button>
      </div>
    </div>
  );
}
