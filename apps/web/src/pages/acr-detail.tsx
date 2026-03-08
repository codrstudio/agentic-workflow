import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, X, Plus, AlertTriangle, Save, Trash2 } from "lucide-react";
import {
  useACR,
  useACRViolations,
  usePatchACR,
  useDeprecateACR,
  useCreateViolation,
  type ACR,
  type ACRViolation,
  type ACRViolationResolution,
  type ACRViolationContext as ViolationCtx,
} from "@/hooks/use-acrs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RESOLUTION_VARIANT: Record<
  ACRViolationResolution,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "destructive",
  accepted: "secondary",
  fixed: "default",
  wontfix: "outline",
};

export function ACRDetailPage() {
  const { projectId, acrId } = useParams({
    from: "/_authenticated/projects/$projectId/artifacts/acrs/$acrId",
  });
  const navigate = useNavigate();

  const { data: acr, isLoading, isError, error } = useACR(projectId, acrId);
  const { data: violations } = useACRViolations(projectId, acrId);
  const patchMutation = usePatchACR(projectId);
  const deprecateMutation = useDeprecateACR(projectId);

  const [editState, setEditState] = useState<Partial<ACR>>({});
  const [dirty, setDirty] = useState(false);
  const [showViolationForm, setShowViolationForm] = useState(false);

  const currentValue = useCallback(
    <K extends keyof ACR>(field: K): ACR[K] | undefined => {
      if (field in editState) return editState[field] as ACR[K];
      return acr?.[field];
    },
    [acr, editState],
  );

  function updateField<K extends keyof ACR>(field: K, value: ACR[K]) {
    setEditState((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!acr || !dirty) return;
    await patchMutation.mutateAsync({ id: acr.id, ...editState });
    setEditState({});
    setDirty(false);
  }

  async function handleDeprecate() {
    if (!acr) return;
    await deprecateMutation.mutateAsync(acr.id);
    navigate({
      to: "/projects/$projectId/artifacts/acrs",
      params: { projectId },
    });
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
          Failed to load ACR: {error.message}
        </div>
      </div>
    );
  }

  if (!acr) return null;

  const tags = (currentValue("tags") as string[]) ?? acr.tags;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Back link */}
      <Link
        to="/projects/$projectId/artifacts/acrs"
        params={{ projectId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to ACRs
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-muted-foreground">
            {acr.slug}
          </span>
          <h1 className="text-2xl font-bold text-foreground">{acr.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              acr.status === "active"
                ? "default"
                : acr.status === "superseded"
                  ? "secondary"
                  : "outline"
            }
          >
            {acr.status}
          </Badge>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              getCategoryColor(acr.category),
            )}
          >
            {acr.category}
          </span>
        </div>
      </div>

      {/* Constraint */}
      <section>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Constraint
        </label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[100px]"
          value={(currentValue("constraint") as string) ?? ""}
          onChange={(e) => updateField("constraint", e.target.value)}
        />
      </section>

      {/* Rationale */}
      <section>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Rationale
        </label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[100px]"
          value={(currentValue("rationale") as string) ?? ""}
          onChange={(e) => updateField("rationale", e.target.value)}
        />
      </section>

      {/* Examples */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">
          Examples
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Compliant
            </label>
            <pre className="min-h-[80px] whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs font-mono">
              {acr.examples?.compliant || "(none)"}
            </pre>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Non-compliant
            </label>
            <pre className="min-h-[80px] whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs font-mono">
              {acr.examples?.non_compliant || "(none)"}
            </pre>
          </div>
        </div>
      </section>

      {/* Tags */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">Tags</h2>
        <TagEditor
          tags={tags}
          onChange={(newTags) => updateField("tags", newTags)}
        />
      </section>

      {/* Violations */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Violations ({violations?.length ?? 0})
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowViolationForm(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Register Violation
          </Button>
        </div>

        {showViolationForm && (
          <ViolationForm
            projectId={projectId}
            acrId={acrId}
            onClose={() => setShowViolationForm(false)}
          />
        )}

        {violations && violations.length > 0 ? (
          <div className="space-y-2">
            {violations.map((v) => (
              <ViolationRow key={v.id} violation={v} />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No violations recorded.
          </p>
        )}
      </section>

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          {acr.superseded_by && (
            <span>
              Superseded by:{" "}
              <Link
                to="/projects/$projectId/artifacts/acrs/$acrId"
                params={{ projectId, acrId: acr.superseded_by }}
                className="text-primary hover:underline"
              >
                {acr.superseded_by}
              </Link>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {acr.status !== "deprecated" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeprecate}
              disabled={deprecateMutation.isPending}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {deprecateMutation.isPending
                ? "Deprecating..."
                : "Mark as deprecated"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || patchMutation.isPending}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            {patchMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={addTag}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ViolationRow({ violation }: { violation: ACRViolation }) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">{violation.description}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{new Date(violation.detected_at).toLocaleDateString()}</span>
          <span>via {violation.context}</span>
          {violation.feature_id && <span>Feature: {violation.feature_id}</span>}
        </div>
      </div>
      <Badge variant={RESOLUTION_VARIANT[violation.resolution]}>
        {violation.resolution}
      </Badge>
    </div>
  );
}

function ViolationForm({
  projectId,
  acrId,
  onClose,
}: {
  projectId: string;
  acrId: string;
  onClose: () => void;
}) {
  const createMutation = useCreateViolation(projectId, acrId);
  const [description, setDescription] = useState("");
  const [context, setContext] = useState<ViolationCtx>("manual");
  const [featureId, setFeatureId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    await createMutation.mutateAsync({
      context,
      description: description.trim(),
      feature_id: featureId.trim() || null,
    });
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-3 rounded-md border bg-muted/20 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium">Description</label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
      <div className="flex gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Context</label>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value as ViolationCtx)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="manual">Manual</option>
            <option value="review">Review</option>
            <option value="import">Import</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">
            Feature ID (optional)
          </label>
          <Input
            value={featureId}
            onChange={(e) => setFeatureId(e.target.value)}
            placeholder="e.g. F-141"
            className="h-8 w-32 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={createMutation.isPending || !description.trim()}
        >
          {createMutation.isPending ? "Registering..." : "Register"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    structure: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    pattern:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    dependency:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    technology:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
    security: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    performance:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    convention:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  };
  return colors[category] ?? colors.other!;
}
