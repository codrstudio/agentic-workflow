import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Flag,
  Clock,
  Eye,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  useReviewDetail,
  useItemDiff,
  useUpdateItemStatus,
  type ReviewDetail,
} from "@/hooks/use-reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DiffViewer } from "@/components/diff-viewer";
import { ReviewChecklist } from "@/components/review-checklist";
import { AgentReviewButton } from "@/components/agent-review-button";

type ReviewStatus = ReviewDetail["status"];
type ItemStatus = "pending" | "approved" | "flagged";
type DiffType = "added" | "modified" | "deleted";

const REVIEW_STATUS_CONFIG: Record<
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

const ITEM_STATUS_CONFIG: Record<
  ItemStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400",
  },
  approved: {
    label: "Approved",
    className:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
  },
  flagged: {
    label: "Flagged",
    className:
      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

const DIFF_TYPE_ICON: Record<DiffType, typeof Plus> = {
  added: Plus,
  modified: Pencil,
  deleted: Trash2,
};

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = REVIEW_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const cfg = ITEM_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px]", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function ItemCard({
  item,
  isSelected,
  onSelect,
  onApprove,
  onFlag,
  isUpdating,
}: {
  item: ReviewDetail["items"][number];
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onFlag: () => void;
  isUpdating: boolean;
}) {
  const DiffIcon = DIFF_TYPE_ICON[item.diff_type];
  const fileName = item.file_path.split("/").pop() ?? item.file_path;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <DiffIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium" title={item.file_path}>
          {fileName}
        </span>
        <ItemStatusBadge status={item.status} />
      </div>
      <div className="text-xs text-muted-foreground truncate">
        {item.file_path}
      </div>
      {item.comment && (
        <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
          {item.comment}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-[10px] text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onApprove();
          }}
          disabled={isUpdating || item.status === "approved"}
        >
          <CheckCircle className="h-3 w-3" />
          Aprovar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-[10px] text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onFlag();
          }}
          disabled={isUpdating || item.status === "flagged"}
        >
          <Flag className="h-3 w-3" />
          Sinalizar
        </Button>
      </div>
    </div>
  );
}

function DiffViewerPanel({
  projectSlug,
  reviewId,
  selectedItemId,
  selectedItem,
}: {
  projectSlug: string;
  reviewId: string;
  selectedItemId: string | null;
  selectedItem: ReviewDetail["items"][number] | undefined;
}) {
  const { data: diff, isLoading } = useItemDiff(
    projectSlug,
    reviewId,
    selectedItemId
  );

  if (!selectedItemId || !selectedItem) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Selecione um item para ver o diff
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3">
        <DiffViewer
          filePath={selectedItem.file_path}
          diffType={selectedItem.diff_type}
          unifiedDiff={diff?.unified_diff ?? ""}
        />
      </div>
    </div>
  );
}

export function ReviewPanelPage() {
  const { projectId, reviewId } = useParams({
    from: "/_authenticated/projects/$projectId/reviews/$reviewId",
  });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    data: review,
    isLoading,
    isError,
    error,
  } = useReviewDetail(projectId, reviewId);

  const updateItem = useUpdateItemStatus(projectId, reviewId);

  const selectedItem = review?.items.find((it) => it.id === selectedItemId);

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    if (isMobile) {
      setSheetOpen(true);
    }
  };

  const handleApprove = (itemId: string) => {
    updateItem.mutate({ itemId, status: "approved" });
  };

  const handleFlag = (itemId: string) => {
    updateItem.mutate({ itemId, status: "flagged" });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border bg-muted"
              />
            ))}
          </div>
          {!isMobile && (
            <div className="h-96 flex-1 animate-pulse rounded-lg border bg-muted" />
          )}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar review: {error.message}
        </div>
      </div>
    );
  }

  if (!review) return null;

  const itemsList = (
    <div className="flex flex-col gap-2">
      {review.items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isSelected={selectedItemId === item.id}
          onSelect={() => handleSelectItem(item.id)}
          onApprove={() => handleApprove(item.id)}
          onFlag={() => handleFlag(item.id)}
          isUpdating={updateItem.isPending}
        />
      ))}
      {review.items.length === 0 && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Nenhum item nesta review
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() =>
            navigate({
              to: "/projects/$projectId/reviews",
              params: { projectId },
            })
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{review.title}</h1>
        </div>
        <AgentReviewButton projectSlug={projectId} reviewId={reviewId} />
        <ReviewStatusBadge status={review.status} />
      </div>

      {/* Content */}
      {isMobile ? (
        /* Mobile: full-width list, click opens diff in Sheet */
        <div className="flex-1 overflow-auto p-4">
          {itemsList}
          <div className="mt-4 border-t pt-4">
            <ReviewChecklist
              projectSlug={projectId}
              reviewId={reviewId}
              review={review}
            />
          </div>
        </div>
      ) : (
        /* Desktop: split view */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: items list + checklist */}
          <div className="w-80 shrink-0 overflow-auto border-r p-4">
            {itemsList}
            <div className="mt-4 border-t pt-4">
              <ReviewChecklist
                projectSlug={projectId}
                reviewId={reviewId}
                review={review}
              />
            </div>
          </div>
          {/* Right: diff viewer */}
          <div className="flex-1 overflow-hidden">
            <DiffViewerPanel
              projectSlug={projectId}
              reviewId={reviewId}
              selectedItemId={selectedItemId}
              selectedItem={selectedItem}
            />
          </div>
        </div>
      )}

      {/* Mobile Sheet for diff */}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle className="truncate">
                {selectedItem?.file_path ?? "Diff"}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-auto">
              <DiffViewerPanel
                projectSlug={projectId}
                reviewId={reviewId}
                selectedItemId={selectedItemId}
                selectedItem={selectedItem}
              />
            </div>
            {selectedItem && (
              <div className="flex items-center gap-2 border-t p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/10"
                  onClick={() => handleApprove(selectedItem.id)}
                  disabled={
                    updateItem.isPending || selectedItem.status === "approved"
                  }
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => handleFlag(selectedItem.id)}
                  disabled={
                    updateItem.isPending || selectedItem.status === "flagged"
                  }
                >
                  <Flag className="h-3.5 w-3.5" />
                  Sinalizar
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
