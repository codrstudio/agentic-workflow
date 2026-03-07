import { FileText, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useSprintFile } from "@/hooks/use-sprints";
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

export function PipelineFileViewer({
  projectSlug,
  sprintNumber,
  phase,
  filename,
  open,
  onOpenChange,
}: PipelineFileViewerProps) {
  const { data: file, isLoading } = useSprintFile(
    projectSlug,
    sprintNumber,
    phase,
    open ? filename : ""
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!file) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const phaseLabel =
    phase === "1-brainstorming"
      ? "Brainstorming"
      : phase === "2-specs"
        ? "Specs"
        : phase === "3-prps"
          ? "PRPs"
          : phase;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg lg:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-base">{filename}</SheetTitle>
          </div>
          <SheetDescription>
            Sprint {sprintNumber} &middot; {phaseLabel}
          </SheetDescription>
          <div className="flex items-center gap-2">
            {file && (
              <Badge variant="secondary">{file.type}</Badge>
            )}
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
          </div>
        </SheetHeader>

        <div className="px-4 pb-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {file && file.type === "markdown" && (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
              {file.content}
            </div>
          )}

          {file && file.type === "json" && (
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(file.content), null, 2);
                } catch {
                  return file.content;
                }
              })()}
            </pre>
          )}

          {file && file.type === "text" && (
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
              {file.content}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
