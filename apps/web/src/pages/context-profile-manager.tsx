import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Layers, Plus, ChevronDown, ChevronRight, Star, Zap, X } from "lucide-react";
import {
  useContextProfiles,
  useCreateProfile,
  useDeleteProfile,
  useApplyProfile,
  type ContextProfile,
} from "@/hooks/use-context-profiles";
import { useSources } from "@/hooks/use-sources";
import { useSourceDensity } from "@/hooks/use-context-density";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---- TokenBudgetBar ----

interface TokenBudgetBarProps {
  used: number;
  total: number;
  className?: string;
}

export function TokenBudgetBar({ used, total, className }: TokenBudgetBarProps) {
  const pct = total > 0 ? Math.min((used / total) * 100, 120) : 0;
  const over = used > total;
  const near = !over && pct >= 80;

  const barColor = over
    ? "bg-red-500"
    : near
    ? "bg-yellow-500"
    : "bg-green-500";

  const labelColor = over
    ? "text-red-600 dark:text-red-400"
    : near
    ? "text-yellow-600 dark:text-yellow-400"
    : "text-green-600 dark:text-green-400";

  function fmt(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Token Budget</span>
        <span className={cn("font-medium tabular-nums", labelColor)}>
          {fmt(used)} / {fmt(total)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ---- Density Score Gauge ----

function DensityGauge({ score }: { score: number }) {
  const color =
    score > 70
      ? "text-green-600 dark:text-green-400"
      : score >= 40
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("text-2xl font-bold tabular-nums", color)}>
        {Math.round(score)}
      </span>
      <span className="text-[10px] text-muted-foreground">Density</span>
    </div>
  );
}

// ---- New Profile Form ----

interface NewProfileFormProps {
  projectSlug: string;
  onClose: () => void;
}

function NewProfileForm({ projectSlug, onClose }: NewProfileFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("24000");
  const [isDefault, setIsDefault] = useState(false);
  const createProfile = useCreateProfile(projectSlug);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProfile.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        token_budget: parseInt(budget, 10) || 24000,
        is_default: isDefault,
        included_sources: [],
        included_categories: [],
        excluded_sources: [],
      },
      { onSuccess: onClose }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Frontend Focus"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-desc">Description (optional)</Label>
        <Input
          id="profile-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-budget">Token Budget</Label>
        <Input
          id="profile-budget"
          type="number"
          min={1000}
          max={200000}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border"
        />
        Set as default profile
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createProfile.isPending || !name.trim()}>
          {createProfile.isPending ? "Creating..." : "Create Profile"}
        </Button>
      </div>
    </form>
  );
}

// ---- Profile Row (expanded/collapsed) ----

interface ProfileRowProps {
  profile: ContextProfile;
  projectSlug: string;
}

function ProfileRow({ profile, projectSlug }: ProfileRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: sources } = useSources(projectSlug);
  const { data: densityMetrics } = useSourceDensity(projectSlug);
  const deleteProfile = useDeleteProfile(projectSlug);
  const applyProfile = useApplyProfile(projectSlug);

  const allSources = sources ?? [];
  const includedSources = allSources.filter(
    (s) => profile.included_sources.includes(s.id) || profile.included_sources.length === 0
  );

  function getDensityScore(sourceId: string): number {
    const m = densityMetrics?.find((d) => d.source_id === sourceId);
    return m ? Math.round(m.information_density) : 0;
  }

  function formatTokens(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{profile.name}</span>
            {profile.is_default && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Star className="h-2.5 w-2.5" /> Default
              </Badge>
            )}
          </div>
          {profile.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {profile.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {formatTokens(profile.current_token_count)} / {formatTokens(profile.token_budget)} tokens
          </span>
          <span>{profile.included_sources.length || allSources.length} sources</span>
          <DensityGauge score={profile.density_score} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 flex flex-col gap-4">
          {/* Token budget bar */}
          <TokenBudgetBar
            used={profile.current_token_count}
            total={profile.token_budget}
          />

          {/* Sources list */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sources ({includedSources.length})
            </h4>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {includedSources.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No sources in this profile yet.
                </p>
              )}
              {includedSources.map((source) => {
                const ds = getDensityScore(source.id);
                const dsColor =
                  ds > 70
                    ? "text-green-600 dark:text-green-400"
                    : ds >= 40
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400";

                return (
                  <div
                    key={source.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/40 text-sm"
                  >
                    <span className="truncate flex-1">{source.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ~{formatTokens(Math.ceil(source.size_bytes / 4))}t
                    </span>
                    {densityMetrics && (
                      <span className={cn("text-xs font-semibold tabular-nums w-6 text-right", dsColor)}>
                        {ds}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => applyProfile.mutate(profile.id)}
              disabled={applyProfile.isPending}
              className="gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              {applyProfile.isPending ? "Activating..." : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive gap-1.5 ml-auto"
              onClick={() => {
                if (confirm(`Delete profile "${profile.name}"?`)) {
                  deleteProfile.mutate(profile.id);
                }
              }}
              disabled={deleteProfile.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

export function ContextProfileManagerPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/sources/profiles",
  });

  const { data: profiles, isLoading, isError } = useContextProfiles(projectId);
  const [newProfileOpen, setNewProfileOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Context Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage source collections with token budgets for AI sessions.
          </p>
        </div>
        <Button size="sm" onClick={() => setNewProfileOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Profile
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load context profiles.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && profiles && profiles.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No context profiles yet. Create one to get started.
          </p>
          <Button size="sm" onClick={() => setNewProfileOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Profile
          </Button>
        </div>
      )}

      {/* Profile list */}
      {!isLoading && !isError && profiles && profiles.length > 0 && (
        <div className="flex flex-col gap-3">
          {profiles.map((profile) => (
            <ProfileRow key={profile.id} profile={profile} projectSlug={projectId} />
          ))}
        </div>
      )}

      {/* New Profile Dialog */}
      <Dialog open={newProfileOpen} onOpenChange={setNewProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Context Profile</DialogTitle>
          </DialogHeader>
          <DialogClose className="absolute right-4 top-4 opacity-70 hover:opacity-100" />
          <NewProfileForm
            projectSlug={projectId}
            onClose={() => setNewProfileOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
