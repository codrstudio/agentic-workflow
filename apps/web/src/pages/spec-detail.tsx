import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, CheckCircle, GitBranch, List, Star } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useSpec,
  useSpecReviews,
  useTriggerSpecReview,
  usePatchSpec,
  type SpecReviewResult,
} from "@/hooks/use-specs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpecStatusBadge, ReviewScoreBadge } from "@/pages/spec-list";
import { cn } from "@/lib/utils";
import type { SpecStatus, ReviewVerdict } from "@/hooks/use-specs";

type Tab = "content" | "reviews" | "features" | "traceability";

const VERDICT_COLORS: Record<ReviewVerdict, string> = {
  approve: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  request_changes: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  reject: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  approve: "Aprovado",
  request_changes: "Mudanças solicitadas",
  reject: "Rejeitado",
};

export function SpecDetailPage() {
  const { projectId, specId } = useParams({
    from: "/_authenticated/projects/$projectId/specs/$specId",
  });

  const [activeTab, setActiveTab] = useState<Tab>("content");

  const { data: spec, isLoading, isError, error } = useSpec(projectId, specId);
  const { data: reviews } = useSpecReviews(projectId, specId);
  const triggerMutation = useTriggerSpecReview(projectId, specId);
  const patchMutation = usePatchSpec(projectId);

  async function handleTriggerReview() {
    await triggerMutation.mutateAsync(["reviewer", "architect"]);
  }

  async function handleApprove() {
    if (!spec) return;
    await patchMutation.mutateAsync({ id: spec.id, status: "approved" as SpecStatus });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load spec: {error.message}
        </div>
      </div>
    );
  }

  if (!spec) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "content", label: "Conteúdo", icon: List },
    { id: "reviews", label: `Reviews${reviews ? ` (${reviews.length})` : ""}`, icon: Star },
    { id: "features", label: `Features (${spec.derived_features.length})`, icon: GitBranch },
    { id: "traceability", label: "Rastreabilidade", icon: CheckCircle },
  ];

  return (
    <div className="flex flex-col gap-0 p-4 sm:p-6">
      {/* Back nav */}
      <Link
        to="/projects/$projectId/specs"
        params={{ projectId }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Specs
      </Link>

      {/* Header */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted-foreground">
            {spec.slug}
          </span>
          <SpecStatusBadge status={spec.status} />
          <span className="text-xs text-muted-foreground">v{spec.version}</span>
          {spec.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{spec.title}</h1>
        {spec.review_score !== null && (
          <div className="flex items-center gap-2">
            <ReviewScoreBadge score={spec.review_score} />
            {spec.reviewed_by.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Revisado por: {spec.reviewed_by.join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-4">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={handleTriggerReview}
          disabled={triggerMutation.isPending}
        >
          <Bot className="h-4 w-4" />
          {triggerMutation.isPending ? "Solicitando..." : "Request AI Review"}
        </Button>
        {spec.status !== "approved" && spec.status !== "completed" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleApprove}
            disabled={patchMutation.isPending}
          >
            <CheckCircle className="h-4 w-4" />
            Aprovar
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" disabled>
          <GitBranch className="h-4 w-4" />
          Derive Features
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-0 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "content" && (
        <ContentTab spec={spec} />
      )}
      {activeTab === "reviews" && (
        <ReviewsTab reviews={reviews ?? []} />
      )}
      {activeTab === "features" && (
        <FeaturesTab featureIds={spec.derived_features} />
      )}
      {activeTab === "traceability" && (
        <TraceabilityTab spec={spec} />
      )}
    </div>
  );
}

function ContentTab({ spec }: { spec: import("@/hooks/use-specs").SpecDocument }) {
  const hasSections = spec.sections && spec.sections.length > 0;

  return (
    <div className="flex gap-6">
      {/* TOC */}
      {hasSections && (
        <aside className="hidden w-48 shrink-0 lg:block">
          <nav className="sticky top-4 space-y-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conteúdo
            </p>
            {spec.sections.map((section) => (
              <a
                key={section.anchor}
                href={`#${section.anchor}`}
                className="block truncate rounded py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>
      )}

      {/* Markdown content */}
      <div className="min-w-0 flex-1">
        {spec.content_md ? (
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {spec.content_md}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Esta spec não tem conteúdo ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function ReviewsTab({ reviews }: { reviews: SpecReviewResult[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma review ainda. Use "Request AI Review" para solicitar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{review.reviewer}</span>
            <ReviewScoreBadge score={review.score} />
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                VERDICT_COLORS[review.verdict],
              )}
            >
              {VERDICT_LABELS[review.verdict]}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>
          {review.comments.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {review.comments.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CommentSeverityDot severity={c.severity} />
                  <span className="text-muted-foreground">{c.comment}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function CommentSeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    blocker: "bg-red-500",
    suggestion: "bg-blue-400",
    praise: "bg-green-500",
  };
  return (
    <span
      className={cn(
        "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
        colors[severity] ?? "bg-gray-400",
      )}
    />
  );
}

function FeaturesTab({ featureIds }: { featureIds: string[] }) {
  if (featureIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma feature derivada desta spec ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {featureIds.map((id) => (
        <div
          key={id}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs font-semibold">{id}</span>
        </div>
      ))}
    </div>
  );
}

function TraceabilityTab({
  spec,
}: {
  spec: { discoveries: string[]; derived_features: string[]; superseded_by: string | null };
}) {
  return (
    <div className="space-y-6">
      {/* Discoveries */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Discoveries ({spec.discoveries.length})</h3>
        {spec.discoveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma discovery linkada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {spec.discoveries.map((d) => (
              <Badge key={d} variant="secondary" className="font-mono text-xs">
                {d}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Derived features */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Features Derivadas ({spec.derived_features.length})</h3>
        {spec.derived_features.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma feature derivada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {spec.derived_features.map((f) => (
              <Badge key={f} variant="outline" className="font-mono text-xs">
                {f}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Superseded by */}
      {spec.superseded_by && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Supersedida por</h3>
          <Badge variant="destructive" className="font-mono text-xs">
            {spec.superseded_by}
          </Badge>
        </section>
      )}
    </div>
  );
}
