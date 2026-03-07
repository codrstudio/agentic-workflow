import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  ClipboardCheck,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  ExternalLink,
  FileText,
} from "lucide-react";
import { useReviews, type ReviewSummary } from "@/hooks/use-reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type ReviewStatus = ReviewSummary["status"];

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400",
  },
  in_review: {
    label: "In Review",
    icon: Eye,
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    className:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
  },
  changes_requested: {
    label: "Changes Requested",
    icon: AlertCircle,
    className:
      "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  },
};

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes Requested" },
];

function ReviewCard({
  review,
  projectId,
}: {
  review: ReviewSummary;
  projectId: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-card-foreground">{review.title}</h3>
        <ReviewStatusBadge status={review.status} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{formatDate(review.created_at)}</span>
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {review.items_count} {review.items_count === 1 ? "item" : "items"}
          {review.items_pending > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
              {review.items_pending} pending
            </Badge>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {review.chat_session_id && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              navigate({
                to: "/projects/$projectId/chat/$sessionId",
                params: { projectId, sessionId: review.chat_session_id! },
              })
            }
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ver conversa
          </Button>
        )}
        {review.step_ref && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              navigate({
                to: "/harness/$projectId",
                params: { projectId },
              })
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver no Harness
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProjectReviewsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/reviews",
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const {
    data: reviews,
    isLoading,
    isError,
    error,
  } = useReviews(projectId, statusFilter === "all" ? undefined : statusFilter);

  const hasReviews = !isLoading && !isError && reviews && reviews.length > 0;
  const hasNoReviews = !isLoading && !isError && reviews && reviews.length === 0;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Verificacao de codigo e artefatos
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar reviews: {error.message}
        </div>
      )}

      {hasNoReviews && (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma review"
          description="Reviews serao criadas automaticamente a partir das sessoes de chat ou do harness."
          className="min-h-[40vh]"
        />
      )}

      {hasReviews && (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
