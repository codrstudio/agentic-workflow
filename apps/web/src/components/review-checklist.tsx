import { useState } from "react";
import { CheckCircle, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type ReviewDetail, useUpdateReview } from "@/hooks/use-reviews";

interface ReviewChecklistProps {
  projectSlug: string;
  reviewId: string;
  review: ReviewDetail;
}

export function ReviewChecklist({
  projectSlug,
  reviewId,
  review,
}: ReviewChecklistProps) {
  const [newCriterion, setNewCriterion] = useState("");
  const updateReview = useUpdateReview(projectSlug, reviewId);

  const criteria = review.criteria;
  const checkedCount = criteria.filter((c) => c.checked).length;
  const totalCount = criteria.length;

  const allItemsApproved =
    review.items.length > 0 &&
    review.items.every((item) => item.status === "approved");
  const allCriteriaChecked = totalCount > 0 && checkedCount === totalCount;
  const canApprove = allItemsApproved && allCriteriaChecked;

  const handleToggle = (criterionId: string, checked: boolean) => {
    const updatedCriteria = criteria.map((c) =>
      c.id === criterionId ? { ...c, checked } : c
    );
    updateReview.mutate({ criteria: updatedCriteria });
  };

  const handleAddCriterion = () => {
    const label = newCriterion.trim();
    if (!label) return;
    const updatedCriteria = [
      ...criteria,
      { label, checked: false },
    ];
    updateReview.mutate({ criteria: updatedCriteria });
    setNewCriterion("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCriterion();
    }
  };

  const handleApproveReview = () => {
    updateReview.mutate({ status: "approved" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Checklist</h3>
        <span className="text-xs text-muted-foreground">
          {checkedCount}/{totalCount} verificados
        </span>
      </div>

      {criteria.length > 0 && (
        <div className="flex flex-col gap-2">
          {criteria.map((criterion) => (
            <label
              key={criterion.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={criterion.checked}
                onCheckedChange={(checked) =>
                  handleToggle(criterion.id, checked === true)
                }
                disabled={updateReview.isPending}
              />
              <span
                className={
                  criterion.checked
                    ? "text-sm line-through text-muted-foreground"
                    : "text-sm"
                }
              >
                {criterion.label}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Adicionar criterio..."
          value={newCriterion}
          onChange={(e) => setNewCriterion(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          disabled={updateReview.isPending}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1"
          onClick={handleAddCriterion}
          disabled={!newCriterion.trim() || updateReview.isPending}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      <Button
        className="gap-1.5 mt-1"
        onClick={handleApproveReview}
        disabled={!canApprove || updateReview.isPending}
      >
        <CheckCircle className="h-4 w-4" />
        Aprovar Review
      </Button>

      {!canApprove && (
        <p className="text-xs text-muted-foreground">
          {!allItemsApproved && "Todos os items devem ser aprovados. "}
          {!allCriteriaChecked &&
            totalCount > 0 &&
            "Todos os criterios devem ser verificados."}
          {totalCount === 0 && "Adicione ao menos um criterio."}
        </p>
      )}
    </div>
  );
}
