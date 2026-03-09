import { Plus, Pencil, Trash2, FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DiffType = "added" | "modified" | "deleted";

interface DiffViewerProps {
  filePath: string;
  diffType: DiffType;
  unifiedDiff: string;
}

const DIFF_TYPE_CONFIG: Record<
  DiffType,
  { label: string; icon: typeof Plus; className: string }
> = {
  added: {
    label: "Added",
    icon: Plus,
    className:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
  },
  modified: {
    label: "Modified",
    icon: Pencil,
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  deleted: {
    label: "Deleted",
    icon: Trash2,
    className:
      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

interface ParsedLine {
  type: "context" | "addition" | "deletion" | "hunk" | "header";
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

function parseDiff(unified: string): ParsedLine[] {
  const rawLines = unified.split("\n");
  const parsed: ParsedLine[] = [];

  let oldLine = 0;
  let newLine = 0;

  for (const line of rawLines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      parsed.push({
        type: "header",
        content: line,
        oldLineNum: null,
        newLineNum: null,
      });
    } else if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1]!, 10);
        newLine = parseInt(match[2]!, 10);
      }
      parsed.push({
        type: "hunk",
        content: line,
        oldLineNum: null,
        newLineNum: null,
      });
    } else if (line.startsWith("+")) {
      parsed.push({
        type: "addition",
        content: line.slice(1),
        oldLineNum: null,
        newLineNum: newLine,
      });
      newLine++;
    } else if (line.startsWith("-")) {
      parsed.push({
        type: "deletion",
        content: line.slice(1),
        oldLineNum: oldLine,
        newLineNum: null,
      });
      oldLine++;
    } else {
      // Context line (may start with space or be empty)
      const content = line.startsWith(" ") ? line.slice(1) : line;
      parsed.push({
        type: "context",
        content,
        oldLineNum: oldLine,
        newLineNum: newLine,
      });
      oldLine++;
      newLine++;
    }
  }

  return parsed;
}

function DiffLine({ line }: { line: ParsedLine }) {
  const bgClass =
    line.type === "addition"
      ? "bg-green-500/10"
      : line.type === "deletion"
        ? "bg-red-500/10"
        : line.type === "hunk"
          ? "bg-blue-500/5"
          : "";

  const textClass =
    line.type === "addition"
      ? "text-green-800 dark:text-green-300"
      : line.type === "deletion"
        ? "text-red-800 dark:text-red-300"
        : line.type === "hunk"
          ? "text-blue-600 dark:text-blue-400 text-[11px] italic"
          : line.type === "header"
            ? "text-muted-foreground font-bold"
            : "";

  const prefix =
    line.type === "addition"
      ? "+"
      : line.type === "deletion"
        ? "-"
        : line.type === "hunk" || line.type === "header"
          ? ""
          : " ";

  const showLineNums = line.type !== "header";

  return (
    <div className={cn("flex", bgClass)}>
      {/* Old line number */}
      <span
        className={cn(
          "inline-block w-12 shrink-0 select-none text-right pr-1 text-[11px] text-muted-foreground/60 border-r border-border/50",
          line.type === "addition" && "bg-green-500/5",
          line.type === "deletion" && "bg-red-500/5"
        )}
      >
        {showLineNums && line.oldLineNum != null ? line.oldLineNum : ""}
      </span>
      {/* New line number */}
      <span
        className={cn(
          "inline-block w-12 shrink-0 select-none text-right pr-1 text-[11px] text-muted-foreground/60 border-r border-border/50",
          line.type === "addition" && "bg-green-500/5",
          line.type === "deletion" && "bg-red-500/5"
        )}
      >
        {showLineNums && line.newLineNum != null ? line.newLineNum : ""}
      </span>
      {/* Prefix (+/-/space) */}
      <span
        className={cn(
          "inline-block w-5 shrink-0 select-none text-center text-[12px]",
          textClass
        )}
      >
        {prefix}
      </span>
      {/* Content */}
      <span className={cn("flex-1 whitespace-pre", textClass)}>
        {line.type === "hunk" || line.type === "header"
          ? line.content
          : line.content || " "}
      </span>
    </div>
  );
}

export function DiffViewer({ filePath, diffType, unifiedDiff }: DiffViewerProps) {
  const cfg = DIFF_TYPE_CONFIG[diffType];
  const DiffIcon = cfg.icon;

  if (!unifiedDiff) {
    return (
      <div className="flex flex-col rounded-lg border bg-card">
        <DiffHeader
          filePath={filePath}
          diffType={diffType}
          icon={DiffIcon}
          cfg={cfg}
        />
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          Nenhum diff disponivel
        </div>
      </div>
    );
  }

  const lines = parseDiff(unifiedDiff);

  return (
    <div className="flex flex-col rounded-lg border bg-card overflow-hidden">
      <DiffHeader
        filePath={filePath}
        diffType={diffType}
        icon={DiffIcon}
        cfg={cfg}
      />
      {/* Scrollable diff content - momentum scroll on mobile */}
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-max">
          <pre className="font-mono text-xs leading-5">
            {lines.map((line, i) => (
              <DiffLine key={i} line={line} />
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

function DiffHeader({
  filePath,
  diffType,
  icon: Icon,
  cfg,
}: {
  filePath: string;
  diffType: DiffType;
  icon: typeof FileCode;
  cfg: (typeof DIFF_TYPE_CONFIG)[DiffType];
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
      <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-mono font-medium truncate flex-1">
        {filePath}
      </span>
      <Badge variant="outline" className={cn("gap-1 shrink-0", cfg.className)}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    </div>
  );
}
