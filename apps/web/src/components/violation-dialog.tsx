import { useState, useEffect } from "react";
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
import {
  useCreateViolation,
  type ACRViolationContext,
} from "@/hooks/use-acrs";

const CONTEXT_OPTIONS: { value: ACRViolationContext; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "review", label: "Review" },
  { value: "import", label: "Import" },
];

interface ViolationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  acrId: string;
  acrSlug: string;
}

export function ViolationDialog({
  open,
  onOpenChange,
  projectSlug,
  acrId,
  acrSlug,
}: ViolationDialogProps) {
  const createMutation = useCreateViolation(projectSlug, acrId);

  const [description, setDescription] = useState("");
  const [context, setContext] = useState<ACRViolationContext>("manual");
  const [artifactId, setArtifactId] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDescription("");
      setContext("manual");
      setArtifactId("");
      setFeatureId("");
      setError("");
      createMutation.reset();
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setError("");
    createMutation.mutate(
      {
        context,
        description: description.trim(),
        artifact_id: artifactId.trim() || null,
        feature_id: featureId.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register Violation</DialogTitle>
          <DialogDescription>
            Register a violation for {acrSlug}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="violation-description">Description *</Label>
            <Textarea
              id="violation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the violation..."
              rows={3}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Context */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="violation-context">Context</Label>
            <select
              id="violation-context"
              value={context}
              onChange={(e) =>
                setContext(e.target.value as ACRViolationContext)
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {CONTEXT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional IDs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="violation-artifact">Artifact ID (optional)</Label>
              <Input
                id="violation-artifact"
                value={artifactId}
                onChange={(e) => setArtifactId(e.target.value)}
                placeholder="e.g. artifact-uuid"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="violation-feature">Feature ID (optional)</Label>
              <Input
                id="violation-feature"
                value={featureId}
                onChange={(e) => setFeatureId(e.target.value)}
                placeholder="e.g. F-141"
              />
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
            {createMutation.isPending ? "Registering..." : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
