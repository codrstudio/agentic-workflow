import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  Clock,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ReviewAgentType,
  AgentReviewResult,
  ReviewFinding,
} from "@/hooks/use-agent-review";

const AGENT_TABS: { type: ReviewAgentType; label: string }[] = [
  { type: "correctness", label: "Correctness" },
  { type: "security", label: "Security" },
  { type: "performance", label: "Performance" },
  { type: "standards", label: "Standards" },
];

const SEVERITY_CONFIG: Record<
  ReviewFinding["severity"],
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className:
      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  },
  warning: {
    label: "Warning",
    className:
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  },
  info: {
    label: "Info",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
};

function AgentStatusIcon({ status }: { status: AgentReviewResult["status"] }) {
  if (status === "pending" || status === "running") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
  }
  if (status === "completed") {
    return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  }
  if (status === "failed") {
    return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  }
  return null;
}

function FindingCard({
  finding,
  onDismiss,
  isDismissing,
  onNavigateToFile,
}: {
  finding: ReviewFinding;
  onDismiss: () => void;
  isDismissing: boolean;
  onNavigateToFile: (filePath: string, line?: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const severity = SEVERITY_CONFIG[finding.severity];

  const fileLabel = finding.line_start
    ? `${finding.file_path}:${finding.line_start}${finding.line_end ? `-${finding.line_end}` : ""}`
    : finding.file_path;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <Badge
          variant="outline"
          className={cn("shrink-0 text-[10px]", severity.className)}
        >
          {severity.label}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{finding.title}</div>
          {finding.file_path && (
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5 text-left"
              onClick={() =>
                onNavigateToFile(finding.file_path, finding.line_start)
              }
            >
              {fileLabel}
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          disabled={isDismissing}
          title="Descartar finding"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {expanded ? "Ocultar detalhes" : "Ver detalhes"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {finding.description}
          </p>
          {finding.suggestion && (
            <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
              {finding.suggestion}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function AgentMetrics({ result }: { result: AgentReviewResult }) {
  if (result.status !== "completed" && result.status !== "failed") return null;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {result.duration_ms > 0 && (
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {(result.duration_ms / 1000).toFixed(1)}s
        </span>
      )}
      {result.tokens_used > 0 && (
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {result.tokens_used.toLocaleString()} tokens
        </span>
      )}
    </div>
  );
}

export function AgentReviewResultsPanel({
  agentResults,
  onDismissFinding,
  isDismissing,
  onNavigateToFile,
}: {
  agentResults: AgentReviewResult[];
  onDismissFinding: (findingId: string) => void;
  isDismissing: boolean;
  onNavigateToFile: (filePath: string, line?: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<ReviewAgentType>("correctness");

  if (agentResults.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Nenhum AI Review executado ainda. Use o botao AI Review para iniciar.
      </div>
    );
  }

  const availableTabs = AGENT_TABS.filter((tab) =>
    agentResults.some((r) => r.agent_type === tab.type)
  );

  const activeResult = agentResults.find((r) => r.agent_type === activeTab);
  const activeFindings =
    activeResult?.findings.filter((f) => !f.dismissed) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Agent tabs */}
      <div className="flex items-center gap-1 border-b pb-1 overflow-x-auto">
        {availableTabs.map((tab) => {
          const result = agentResults.find((r) => r.agent_type === tab.type);
          const findingsCount =
            result?.findings.filter((f) => !f.dismissed).length ?? 0;

          return (
            <button
              key={tab.type}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors whitespace-nowrap",
                activeTab === tab.type
                  ? "bg-background border border-b-0 border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => setActiveTab(tab.type)}
            >
              {result && <AgentStatusIcon status={result.status} />}
              {tab.label}
              {result?.status === "completed" && findingsCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 justify-center rounded-full px-1 text-[9px]"
                >
                  {findingsCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {activeResult ? (
        <div className="flex flex-col gap-3">
          {/* Summary + metrics */}
          <div className="flex items-start justify-between gap-2">
            {activeResult.summary && (
              <p className="text-xs text-muted-foreground flex-1">
                {activeResult.summary}
              </p>
            )}
            <AgentMetrics result={activeResult} />
          </div>

          {/* Status messages */}
          {(activeResult.status === "pending" ||
            activeResult.status === "running") && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando...
            </div>
          )}

          {activeResult.status === "failed" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
              Falha na analise do agente.
            </div>
          )}

          {/* Findings */}
          {activeResult.status === "completed" && (
            <>
              {activeFindings.length === 0 ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Nenhum finding encontrado
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeFindings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onDismiss={() => onDismissFinding(finding.id)}
                      isDismissing={isDismissing}
                      onNavigateToFile={onNavigateToFile}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
          Agente nao executado
        </div>
      )}
    </div>
  );
}
