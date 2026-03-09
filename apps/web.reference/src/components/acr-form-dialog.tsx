import { useState, useEffect } from "react";
import { z } from "zod";
import { X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateACR, type ACRCategory } from "@/hooks/use-acrs";

const CATEGORY_OPTIONS: { value: ACRCategory; label: string }[] = [
  { value: "structure", label: "Structure" },
  { value: "pattern", label: "Pattern" },
  { value: "dependency", label: "Dependency" },
  { value: "technology", label: "Technology" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Performance" },
  { value: "convention", label: "Convention" },
  { value: "other", label: "Other" },
];

const acrFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.enum([
    "structure",
    "pattern",
    "dependency",
    "technology",
    "security",
    "performance",
    "convention",
    "other",
  ]),
  constraint: z.string().min(10, "Constraint must be at least 10 characters"),
  rationale: z.string().min(10, "Rationale must be at least 10 characters"),
  compliant: z.string().optional(),
  non_compliant: z.string().optional(),
  tags: z.array(z.string()),
});

interface ACRFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
}

export function ACRFormDialog({
  open,
  onOpenChange,
  projectSlug,
}: ACRFormDialogProps) {
  const createMutation = useCreateACR(projectSlug);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ACRCategory>("structure");
  const [constraint, setConstraint] = useState("");
  const [rationale, setRationale] = useState("");
  const [compliant, setCompliant] = useState("");
  const [nonCompliant, setNonCompliant] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory("structure");
      setConstraint("");
      setRationale("");
      setCompliant("");
      setNonCompliant("");
      setTags([]);
      setTagInput("");
      setErrors({});
      createMutation.reset();
    }
  }, [open]);

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = acrFormSchema.safeParse({
      title: title.trim(),
      category,
      constraint: constraint.trim(),
      rationale: rationale.trim(),
      compliant: compliant.trim() || undefined,
      non_compliant: nonCompliant.trim() || undefined,
      tags,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key && typeof key === "string") {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    const examples =
      compliant.trim() || nonCompliant.trim()
        ? {
            compliant: compliant.trim() || undefined,
            non_compliant: nonCompliant.trim() || undefined,
          }
        : undefined;

    createMutation.mutate(
      {
        title: result.data.title,
        category: result.data.category,
        constraint: result.data.constraint,
        rationale: result.data.rationale,
        examples,
        tags: result.data.tags,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ACR</DialogTitle>
          <DialogDescription>
            Create a new Architectural Constraint Record
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acr-title">Title *</Label>
            <Input
              id="acr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. No direct database queries in handlers"
              aria-invalid={!!errors["title"]}
              autoFocus
            />
            {errors["title"] && (
              <p className="text-sm text-destructive">{errors["title"]}</p>
            )}
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acr-category">Category *</Label>
            <select
              id="acr-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ACRCategory)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Constraint */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acr-constraint">Constraint * (min 10 chars)</Label>
            <Textarea
              id="acr-constraint"
              value={constraint}
              onChange={(e) => setConstraint(e.target.value)}
              placeholder="Describe the architectural constraint..."
              rows={3}
              aria-invalid={!!errors["constraint"]}
            />
            {errors["constraint"] && (
              <p className="text-sm text-destructive">{errors["constraint"]}</p>
            )}
          </div>

          {/* Rationale */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acr-rationale">Rationale * (min 10 chars)</Label>
            <Textarea
              id="acr-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why is this constraint important?"
              rows={3}
              aria-invalid={!!errors["rationale"]}
            />
            {errors["rationale"] && (
              <p className="text-sm text-destructive">{errors["rationale"]}</p>
            )}
          </div>

          {/* Examples (optional) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acr-compliant">Compliant example (optional)</Label>
              <Textarea
                id="acr-compliant"
                value={compliant}
                onChange={(e) => setCompliant(e.target.value)}
                placeholder="Code example..."
                rows={3}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acr-non-compliant">
                Non-compliant example (optional)
              </Label>
              <Textarea
                id="acr-non-compliant"
                value={nonCompliant}
                onChange={(e) => setNonCompliant(e.target.value)}
                placeholder="Code example..."
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag..."
                  className="h-7 w-28 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={addTag}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {createMutation.isError && (
            <p className="text-sm text-destructive">
              {createMutation.error?.message}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create ACR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
