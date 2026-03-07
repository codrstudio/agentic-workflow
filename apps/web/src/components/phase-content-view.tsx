import { useState } from "react";
import {
  FileText,
  FileJson,
  ClipboardList,
  CheckSquare,
} from "lucide-react";
import { useSprintFile, useSprintFeatures } from "@/hooks/use-sprints";
import { useAllTemplates } from "@/hooks/use-task-complexity";
import type { ComplexityLevel } from "@/hooks/use-task-complexity";
import { Badge } from "@/components/ui/badge";
import { ComplexityBadge } from "@/components/complexity-badge";
import { PipelineFileViewer } from "@/components/pipeline-file-viewer";
import { RankingTable, type RankingDiscovery } from "@/components/ranking-table";
import { FeatureStatusTable } from "@/components/feature-status-table";
import { cn } from "@/lib/utils";

interface PhaseContentViewProps {
  projectSlug: string;
  sprintNumber: number;
  phase: string;
  files: string[];
}

export function PhaseContentView({
  projectSlug,
  sprintNumber,
  phase,
  files,
}: PhaseContentViewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (phase === "features") {
    return (
      <FeaturePhaseView
        projectSlug={projectSlug}
        sprintNumber={sprintNumber}
      />
    );
  }

  if (phase === "1-brainstorming") {
    const hasRanking = files.includes("ranking.json");
    // Don't open ranking.json in the generic file viewer — RankingTable handles it
    const viewerFile =
      selectedFile === "ranking.json" ? null : selectedFile;

    return (
      <>
        <BrainstormingPhaseView
          projectSlug={projectSlug}
          sprintNumber={sprintNumber}
          files={files}
          onFileClick={setSelectedFile}
        />
        {hasRanking && (
          <BrainstormingRankingSection
            projectSlug={projectSlug}
            sprintNumber={sprintNumber}
          />
        )}
        {viewerFile && (
          <PipelineFileViewer
            projectSlug={projectSlug}
            sprintNumber={sprintNumber}
            phase={phase}
            filename={viewerFile}
            open={!!viewerFile}
            onOpenChange={(open) => {
              if (!open) setSelectedFile(null);
            }}
          />
        )}
      </>
    );
  }

  // Specs and PRPs: cards with ID and title
  return (
    <>
      <CardPhaseView
        projectSlug={projectSlug}
        sprintNumber={sprintNumber}
        phase={phase}
        files={files}
        onFileClick={setSelectedFile}
      />
      {selectedFile && (
        <PipelineFileViewer
          projectSlug={projectSlug}
          sprintNumber={sprintNumber}
          phase={phase}
          filename={selectedFile}
          open={!!selectedFile}
          onOpenChange={(open) => {
            if (!open) setSelectedFile(null);
          }}
        />
      )}
    </>
  );
}

function BrainstormingRankingSection({
  projectSlug,
  sprintNumber,
}: {
  projectSlug: string;
  sprintNumber: number;
}) {
  const { data: file } = useSprintFile(
    projectSlug,
    sprintNumber,
    "1-brainstorming",
    "ranking.json"
  );

  if (!file) return null;

  let discoveries: RankingDiscovery[] = [];
  try {
    const parsed = JSON.parse(file.content) as { discoveries?: RankingDiscovery[] };
    discoveries = parsed.discoveries ?? [];
  } catch {
    return null;
  }

  if (discoveries.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Ranking</h3>
      <RankingTable discoveries={discoveries} />
    </div>
  );
}

function BrainstormingPhaseView({
  projectSlug,
  sprintNumber,
  files,
  onFileClick,
}: {
  projectSlug: string;
  sprintNumber: number;
  files: string[];
  onFileClick: (filename: string) => void;
}) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No brainstorming files yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {files.map((filename) => {
        const ext = filename.split(".").pop()?.toLowerCase();
        const Icon = ext === "json" ? FileJson : FileText;

        return (
          <button
            key={filename}
            type="button"
            onClick={() => onFileClick(filename)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{filename}</span>
          </button>
        );
      })}
    </div>
  );
}

function CardPhaseView({
  projectSlug,
  sprintNumber,
  phase,
  files,
  onFileClick,
}: {
  projectSlug: string;
  sprintNumber: number;
  phase: string;
  files: string[];
  onFileClick: (filename: string) => void;
}) {
  const { data: templates } = useAllTemplates(projectSlug);

  // Specs = medium (spec_completa), PRPs = large (prp_completo)
  const complexityLevel: ComplexityLevel =
    phase === "2-specs" ? "medium" : "large";
  const template = templates?.find((t) => t.level === complexityLevel);

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No {phase === "2-specs" ? "specs" : "PRPs"} yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {files.map((filename) => (
        <SpecPrpCard
          key={filename}
          projectSlug={projectSlug}
          sprintNumber={sprintNumber}
          phase={phase}
          filename={filename}
          complexityLevel={complexityLevel}
          requiredSections={template?.required_sections}
          onClick={() => onFileClick(filename)}
        />
      ))}
    </div>
  );
}

function extractIdFromFilename(filename: string): string | null {
  // Match patterns like S-006-xxx.md or PRP-006-xxx.md
  const match = filename.match(/^((?:S|PRP)-\d+)/);
  return match ? match[1]! : null;
}

function extractH1FromContent(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1]!.trim() : null;
}

function SpecPrpCard({
  projectSlug,
  sprintNumber,
  phase,
  filename,
  complexityLevel,
  requiredSections,
  onClick,
}: {
  projectSlug: string;
  sprintNumber: number;
  phase: string;
  filename: string;
  complexityLevel?: ComplexityLevel;
  requiredSections?: string[];
  onClick: () => void;
}) {
  const { data: file } = useSprintFile(
    projectSlug,
    sprintNumber,
    phase,
    filename
  );

  const id = extractIdFromFilename(filename);
  const title = file ? extractH1FromContent(file.content) : null;
  const Icon = phase === "2-specs" ? FileText : ClipboardList;

  // Fallback title from filename
  const fallbackTitle = filename
    .replace(/^(?:S|PRP)-\d+-/, "")
    .replace(/\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
        "hover:bg-accent hover:text-accent-foreground hover:border-accent",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1.5">
          {id && (
            <Badge variant="secondary" className="text-xs">
              {id}
            </Badge>
          )}
          {complexityLevel && (
            <ComplexityBadge
              level={complexityLevel}
              requiredSections={requiredSections}
            />
          )}
        </div>
        <p className="font-medium leading-snug">
          {title ?? fallbackTitle}
        </p>
      </div>
    </button>
  );
}

function FeaturePhaseView({
  projectSlug,
  sprintNumber,
}: {
  projectSlug: string;
  sprintNumber: number;
}) {
  const { data: features, isLoading } = useSprintFeatures(
    projectSlug,
    sprintNumber
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!features || features.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckSquare className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No features yet.</p>
      </div>
    );
  }

  return <FeatureStatusTable features={features} />;
}
