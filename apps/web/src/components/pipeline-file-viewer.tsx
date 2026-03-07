import {
  FileText,
  FileJson,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSprintFile } from "@/hooks/use-sprints";
import { useCreateArtifact, type ArtifactType } from "@/hooks/use-artifacts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface PipelineFileViewerProps {
  projectSlug: string;
  sprintNumber: number;
  phase: string;
  filename: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PHASE_LABELS: Record<string, string> = {
  "1-brainstorming": "Brainstorming",
  "2-specs": "Specs",
  "3-prps": "PRPs",
};

function getPhaseLabel(phase: string) {
  return PHASE_LABELS[phase] ?? phase;
}

function getArtifactType(fileType: string): ArtifactType {
  if (fileType === "json") return "json";
  return "document";
}

function JsonTreeView({ data, level = 0 }: { data: unknown; level?: number }) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof data === "boolean") {
    return (
      <span className="text-blue-500">{data ? "true" : "false"}</span>
    );
  }

  if (typeof data === "number") {
    return <span className="text-emerald-600">{data}</span>;
  }

  if (typeof data === "string") {
    return (
      <span className="text-amber-600 break-all">
        &quot;{data.length > 200 ? data.slice(0, 200) + "..." : data}&quot;
      </span>
    );
  }

  if (Array.isArray(data)) {
    return <JsonArrayView items={data} level={level} />;
  }

  if (typeof data === "object") {
    return (
      <JsonObjectView obj={data as Record<string, unknown>} level={level} />
    );
  }

  return <span>{String(data)}</span>;
}

function JsonArrayView({
  items,
  level,
}: {
  items: unknown[];
  level: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);

  if (items.length === 0) return <span className="text-muted-foreground">[]</span>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="text-xs">Array[{items.length}]</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border pl-2">
          {items.map((item, i) => (
            <div key={i} className="py-0.5">
              <span className="text-muted-foreground text-xs mr-1">{i}:</span>
              <JsonTreeView data={item} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonObjectView({
  obj,
  level,
}: {
  obj: Record<string, unknown>;
  level: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const keys = Object.keys(obj);

  if (keys.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="text-xs">Object{`{${keys.length}}`}</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border pl-2">
          {keys.map((key) => (
            <div key={key} className="py-0.5">
              <span className="font-semibold text-sm mr-1">{key}:</span>
              <JsonTreeView data={obj[key]} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full">{children}</table>
            </div>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${className} block`}>{children}</code>
              );
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-sm">
              {children}
            </pre>
          ),
        }}
      />
    </div>
  );
}

function JsonContent({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content);
    return (
      <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm overflow-x-auto">
        <JsonTreeView data={parsed} />
      </div>
    );
  } catch {
    return (
      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-xs">
        {content}
      </pre>
    );
  }
}

export function PipelineFileViewer({
  projectSlug,
  sprintNumber,
  phase,
  filename,
  open,
  onOpenChange,
}: PipelineFileViewerProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: file, isLoading } = useSprintFile(
    projectSlug,
    sprintNumber,
    phase,
    open ? filename : ""
  );
  const createArtifact = useCreateArtifact(projectSlug);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!file) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [file]);

  const handleOpenInArtifacts = useCallback(() => {
    if (!file) return;
    const artifactType = getArtifactType(file.type);
    const name = `${filename} (Sprint ${sprintNumber} - ${getPhaseLabel(phase)})`;
    createArtifact.mutate(
      {
        name,
        type: artifactType,
        content: file.content,
        origin: "manual",
        tags: ["pipeline", phase],
      },
      {
        onSuccess: () => {
          navigate({ to: "/projects/$projectId/artifacts", params: { projectId: projectSlug } });
          onOpenChange(false);
        },
      }
    );
  }, [file, filename, sprintNumber, phase, projectSlug, createArtifact, navigate, onOpenChange]);

  const phaseLabel = getPhaseLabel(phase);
  const isMarkdown = file?.type === "markdown";
  const isJson = file?.type === "json";
  const FileIcon = isJson ? FileJson : FileText;

  const viewerContent = (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <SheetTitle className="text-base truncate">{filename}</SheetTitle>
        </div>
        <SheetDescription>
          Sprint {sprintNumber} &middot; {phaseLabel}
        </SheetDescription>
        <div className="flex items-center gap-2 flex-wrap">
          {file && <Badge variant="secondary">{file.type}</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!file}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInArtifacts}
            disabled={!file || createArtifact.isPending}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            {createArtifact.isPending ? "Creating..." : "Artifacts"}
          </Button>
        </div>
      </SheetHeader>

      <div className="px-4 pb-4">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {file && isMarkdown && <MarkdownContent content={file.content} />}

        {file && isJson && <JsonContent content={file.content} />}

        {file && !isMarkdown && !isJson && (
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
            {file.content}
          </pre>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto">
          {viewerContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg lg:max-w-2xl overflow-y-auto"
      >
        {viewerContent}
      </SheetContent>
    </Sheet>
  );
}
