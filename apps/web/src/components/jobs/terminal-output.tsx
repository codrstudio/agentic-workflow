import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine } from "lucide-react";

interface TerminalLine {
  type: "stdout" | "stderr";
  text: string;
}

interface TerminalOutputProps {
  stdout: string;
  stderr: string;
  streaming?: boolean;
  jobId?: string;
}

const MAX_LINES = 10_000;

function parseInitialLines(stdout: string, stderr: string): TerminalLine[] {
  const lines: TerminalLine[] = [];
  if (stdout) {
    for (const line of stdout.split("\n")) {
      lines.push({ type: "stdout", text: line });
    }
  }
  if (stderr) {
    for (const line of stderr.split("\n")) {
      lines.push({ type: "stderr", text: line });
    }
  }
  return lines;
}

export function TerminalOutput({
  stdout,
  stderr,
  streaming,
  jobId,
}: TerminalOutputProps) {
  const [lines, setLines] = useState<TerminalLine[]>(() =>
    parseInitialLines(stdout, stderr),
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore((s) => s.token);

  // SSE streaming for active jobs
  useEffect(() => {
    if (!streaming || !jobId || !token) return;

    const es = new EventSource(
      `/api/v1/ai/jobs/${jobId}/stream?token=${encodeURIComponent(token)}`,
    );

    es.addEventListener("stdout", (ev) => {
      try {
        const data = JSON.parse(ev.data) as { line: string };
        setLines((prev) => {
          const next = [...prev, { type: "stdout" as const, text: data.line }];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("stderr", (ev) => {
      try {
        const data = JSON.parse(ev.data) as { line: string };
        setLines((prev) => {
          const next = [...prev, { type: "stderr" as const, text: data.line }];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [streaming, jobId, token]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[400px] overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-5"
      >
        {lines.length === 0 ? (
          <span className="text-zinc-500">Sem saida</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === "stderr"
                  ? "text-red-400 whitespace-pre-wrap break-all"
                  : "text-zinc-300 whitespace-pre-wrap break-all"
              }
            >
              {line.text || "\u00A0"}
            </div>
          ))
        )}
      </div>
      {!autoScroll && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-3 right-3 gap-1.5 opacity-90"
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            }
          }}
        >
          <ArrowDownToLine className="size-3.5" />
          Auto-scroll
        </Button>
      )}
    </div>
  );
}
