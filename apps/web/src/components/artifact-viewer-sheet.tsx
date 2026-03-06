import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Code,
  Braces,
  GitFork,
  Settings,
  Copy,
  Download,
  Eye,
  Pencil,
  X,
  Plus,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useArtifact,
  useUpdateArtifact,
  type Artifact,
  type ArtifactType,
  type ArtifactOrigin,
} from "@/hooks/use-artifacts";

const typeIcons: Record<ArtifactType, LucideIcon> = {
  document: FileText,
  code: Code,
  json: Braces,
  diagram: GitFork,
  config: Settings,
};

const typeLabels: Record<ArtifactType, string> = {
  document: "Document",
  code: "Code",
  json: "JSON",
  diagram: "Diagram",
  config: "Config",
};

const originLabels: Record<ArtifactOrigin, string> = {
  chat: "Chat",
  harness: "Harness",
  manual: "Manual",
};

interface ArtifactViewerSheetProps {
  artifactId: string | null;
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtifactViewerSheet({
  artifactId,
  projectSlug,
  open,
  onOpenChange,
}: ArtifactViewerSheetProps) {
  const isMobile = useIsMobile();
  const { data: artifact, isLoading } = useArtifact(projectSlug, artifactId);
  const updateMutation = useUpdateArtifact(projectSlug);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (artifact) {
      setName(artifact.name);
      setContent(artifact.content ?? "");
      setTags([...artifact.tags]);
      setEditMode(false);
      setNewTag("");
      setCopied(false);
    }
  }, [artifact]);

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
      setNewTag("");
    }
  }, [newTag, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSave = useCallback(() => {
    if (!artifactId) return;
    const updates: {
      id: string;
      name?: string;
      content?: string;
      tags?: string[];
    } = { id: artifactId };

    if (artifact && name !== artifact.name) updates.name = name;
    if (artifact && content !== (artifact.content ?? ""))
      updates.content = content;
    if (artifact && JSON.stringify(tags) !== JSON.stringify(artifact.tags))
      updates.tags = tags;

    if (Object.keys(updates).length > 1) {
      updateMutation.mutate(updates, {
        onSuccess: () => setEditMode(false),
      });
    }
  }, [artifactId, artifact, name, content, tags, updateMutation]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in insecure contexts
    }
  }, [content]);

  const handleExport = useCallback(() => {
    if (!artifactId) return;
    window.open(
      `/api/v1/hub/projects/${projectSlug}/artifacts/${artifactId}/export`,
      "_blank",
    );
  }, [artifactId, projectSlug]);

  const hasChanges =
    artifact &&
    (name !== artifact.name ||
      content !== (artifact.content ?? "") ||
      JSON.stringify(tags) !== JSON.stringify(artifact.tags));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[90vh] overflow-y-auto"
            : "w-full sm:max-w-lg lg:max-w-2xl overflow-y-auto"
        }
      >
        {isLoading && <SheetLoadingSkeleton />}

        {artifact && (
          <>
            <SheetHeader className="gap-3 pr-8">
              {/* Editable name */}
              <SheetTitle className="sr-only">{name}</SheetTitle>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg font-semibold border-transparent hover:border-input focus:border-input transition-colors"
                aria-label="Artifact name"
              />
              <SheetDescription className="sr-only">
                View and edit artifact
              </SheetDescription>

              {/* Badges: type, origin, version */}
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = typeIcons[artifact.type];
                  return (
                    <Badge variant="outline" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {typeLabels[artifact.type]}
                    </Badge>
                  );
                })()}
                <Badge variant="secondary">
                  {originLabels[artifact.origin]}
                </Badge>
                <Badge variant="outline">v{artifact.version}</Badge>
              </div>

              {/* Editable tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="h-6 w-20 px-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Add tag"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Toolbar: Copy, Export, Edit/Preview toggle */}
              <div className="flex items-center gap-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
                <Button
                  variant={editMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditMode((v) => !v)}
                  className="gap-1.5 text-xs ml-auto"
                >
                  {editMode ? (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </>
                  ) : (
                    <>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </>
                  )}
                </Button>
              </div>
            </SheetHeader>

            {/* Body — type-specific content */}
            <div className="flex-1 px-4 min-h-0">
              <ArtifactBody
                artifact={artifact}
                content={content}
                onContentChange={setContent}
                editMode={editMode}
              />
            </div>

            {/* Footer: origin + save */}
            <SheetFooter className="flex-row items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                Origin: <span className="font-medium">{originLabels[artifact.origin]}</span>
                {artifact.session_id && (
                  <span className="ml-1">
                    &middot; Session {artifact.session_id.slice(0, 8)}
                  </span>
                )}
                {artifact.step_ref && (
                  <span className="ml-1">
                    &middot; {artifact.step_ref}
                  </span>
                )}
              </div>
              {hasChanges && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ArtifactBody({
  artifact,
  content,
  onContentChange,
  editMode,
}: {
  artifact: Artifact;
  content: string;
  onContentChange: (val: string) => void;
  editMode: boolean;
}) {
  if (editMode) {
    return (
      <Textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="min-h-[300px] font-mono text-sm"
        placeholder="Edit content..."
      />
    );
  }

  switch (artifact.type) {
    case "document":
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none rounded-md border p-3 min-h-[200px]"
          dangerouslySetInnerHTML={{
            __html: simpleMarkdownToHtml(content),
          }}
        />
      );

    case "code":
      return (
        <div className="rounded-md border bg-muted/30 overflow-auto">
          <pre className="p-3 text-sm font-mono">
            <code>
              {content.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground select-none text-xs leading-6">
                    {i + 1}
                  </span>
                  <span className="leading-6">{line || " "}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      );

    case "json":
      return (
        <div className="rounded-md border bg-muted/30 overflow-auto">
          <pre className="p-3 text-sm font-mono whitespace-pre-wrap">
            {formatJson(content)}
          </pre>
        </div>
      );

    case "config":
      return (
        <div className="rounded-md border bg-muted/30 overflow-auto">
          <pre className="p-3 text-sm font-mono whitespace-pre-wrap">
            <code>{content}</code>
          </pre>
        </div>
      );

    case "diagram":
      return (
        <div className="rounded-md border bg-muted/30 overflow-auto">
          <pre className="p-3 text-sm font-mono whitespace-pre-wrap">
            <code>{content}</code>
          </pre>
        </div>
      );

    default:
      return (
        <pre className="rounded-md border p-3 text-sm whitespace-pre-wrap">
          {content}
        </pre>
      );
  }
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-muted rounded p-2 overflow-auto"><code>$2</code></pre>',
  );

  // headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // line breaks -> paragraphs
  html = html
    .split("\n\n")
    .map((p) => {
      const trimmed = p.trim();
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<ul")
      )
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  return html;
}

function SheetLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-10 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-18 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16 ml-auto" />
      </div>
      <Skeleton className="h-[300px] w-full" />
      <div className="flex justify-between items-center border-t pt-4">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
