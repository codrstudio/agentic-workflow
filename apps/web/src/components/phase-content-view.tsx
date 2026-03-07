import { useState } from "react";
import {
  FileText,
  FileJson,
  ClipboardList,
  CheckSquare,
} from "lucide-react";
import { useSprintFile, useSprintFeatures } from "@/hooks/use-sprints";
import { Badge } from "@/components/ui/badge";
import { PipelineFileViewer } from "@/components/pipeline-file-viewer";
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
    return (
      <>
        <BrainstormingPhaseView
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

function BrainstormingPhaseView({
  files,
  onFileClick,
}: {
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
  onClick,
}: {
  projectSlug: string;
  sprintNumber: number;
  phase: string;
  filename: string;
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
        {id && (
          <Badge variant="secondary" className="mb-1.5 text-xs">
            {id}
          </Badge>
        )}
        <p className="font-medium leading-snug">
          {title ?? fallbackTitle}
        </p>
      </div>
    </button>
  );
}

const featureStatusColors: Record<string, string> = {
  passing: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failing: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  skipped: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  blocked: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

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

  // FeatureStatusTable placeholder (F-037 will replace this)
  const passingCount = features.filter((f) => f.status === "passing").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {passingCount}/{features.length} passing
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">ID</th>
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 font-medium">Deps</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-mono text-xs">{feature.id}</td>
                <td className="py-2 pr-4">{feature.name}</td>
                <td className="py-2 pr-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      featureStatusColors[feature.status] ?? featureStatusColors["pending"]
                    )}
                  >
                    {feature.status}
                  </span>
                </td>
                <td className="py-2">
                  {feature.dependencies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {feature.dependencies.map((dep) => (
                        <Badge key={dep} variant="outline" className="text-xs">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
