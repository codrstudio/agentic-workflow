import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronUp, Terminal } from "lucide-react";
import { useStepLog } from "@/hooks/use-harness";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  projectSlug: string;
  waveNumber: number;
  stepNumber: number;
  isRunning: boolean;
}

interface ParsedLine {
  raw: string;
  timestamp?: string;
  isError: boolean;
  text: string;
}

function parseLine(raw: string): ParsedLine {
  const trimmed = raw.trim();
  if (!trimmed) return { raw, isError: false, text: "" };

  // Try to parse as JSON (spawn.jsonl lines are JSON objects)
  try {
    const obj = JSON.parse(trimmed);

    const isError =
      obj.type === "error" ||
      obj.subtype === "error" ||
      (typeof obj.error === "string" && obj.error.length > 0) ||
      (typeof obj.result === "string" &&
        /error|fail|exception/i.test(obj.result));

    // Extract a human-readable text
    let text = "";
    if (obj.message) text = obj.message;
    else if (obj.result) text = typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result);
    else if (obj.content) text = typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content);
    else text = trimmed;

    // Truncate long lines for display
    if (text.length > 500) text = text.slice(0, 500) + "...";

    return {
      raw,
      timestamp: obj.timestamp ?? obj.ts ?? undefined,
      isError,
      text,
    };
  } catch {
    // Not JSON — raw text line
    const isError = /error|fail|exception|EPERM|ENOENT/i.test(trimmed);
    return { raw, isError, text: trimmed };
  }
}

const INITIAL_TAIL = 50;
const LOAD_MORE_INCREMENT = 100;

export function LogViewer({
  projectSlug,
  waveNumber,
  stepNumber,
  isRunning,
}: LogViewerProps) {
  const [tail, setTail] = useState(INITIAL_TAIL);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const { data: logData, isLoading } = useStepLog(
    projectSlug,
    waveNumber,
    stepNumber,
    tail,
    true
  );

  const parsedLines = useMemo(
    () => (logData?.lines ?? []).map(parseLine).filter((l) => l.text),
    [logData?.lines]
  );

  const hasMore =
    logData != null && logData.total_lines > logData.returned_lines;

  // Auto-scroll to bottom when running and new lines arrive
  useEffect(() => {
    if (isRunning && autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [parsedLines, isRunning]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  const handleLoadMore = () => {
    setTail((prev) => prev + LOAD_MORE_INCREMENT);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Terminal className="h-4 w-4" />
          Log
          {logData && (
            <span className="text-xs">
              ({logData.returned_lines}/{logData.total_lines} lines)
            </span>
          )}
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Live
          </span>
        )}
      </div>

      {hasMore && (
        <button
          onClick={handleLoadMore}
          className="flex items-center justify-center gap-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <ChevronUp className="h-3 w-3" />
          Carregar mais
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[400px] overflow-y-auto overflow-x-auto rounded-md border bg-muted/30 font-mono text-xs"
      >
        {isLoading ? (
          <div className="p-4 text-muted-foreground">Loading log...</div>
        ) : parsedLines.length === 0 ? (
          <div className="p-4 text-muted-foreground">No log output</div>
        ) : (
          <div className="p-2 space-y-px">
            {parsedLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre-wrap break-all px-2 py-0.5 rounded-sm",
                  line.isError && "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
              >
                {line.timestamp && (
                  <span className="text-muted-foreground mr-2 select-none">
                    {formatTimestamp(line.timestamp)}
                  </span>
                )}
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}
