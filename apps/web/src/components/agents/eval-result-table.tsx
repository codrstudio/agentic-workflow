import { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import type { EvalResult, EvalRunDetail } from "@/api/evaluation";
import { EvalScoreBadge } from "@/components/agents/eval-score-badge";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/api";

interface EvalResultTableProps {
  run: EvalRunDetail;
  agentId: string;
}

interface ResultRowProps {
  result: EvalResult;
  agentId: string;
  setId: number;
}

function ResultRow({ result, agentId, setId }: ResultRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const failed = result.score < 0.7;

  async function handleExport() {
    setExporting(true);
    try {
      await request(`/agents/${agentId}/eval-sets/${setId}/cases`, {
        method: "POST",
        body: JSON.stringify({ input: result.input, expected: result.actual }),
      });
      toast.success("Caso adicionado ao eval set");
    } catch {
      toast.error("Erro ao exportar caso");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <tr
        className={`cursor-pointer border-b transition-colors hover:bg-muted/40 ${
          failed ? "bg-red-500/5" : ""
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 align-top">
          <span className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="inline size-3.5" />
            ) : (
              <ChevronRight className="inline size-3.5" />
            )}
          </span>
        </td>
        <td className="px-3 py-2 align-top">
          <p className="max-w-xs truncate text-sm">{result.input}</p>
        </td>
        <td className="px-3 py-2 align-top">
          <p className="max-w-xs truncate text-sm text-muted-foreground">
            {result.expected}
          </p>
        </td>
        <td className="px-3 py-2 align-top">
          <p
            className={`max-w-xs truncate text-sm ${
              failed ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {result.actual}
          </p>
        </td>
        <td className="px-3 py-2 align-top text-center">
          <EvalScoreBadge score={result.score} />
        </td>
        <td className="px-3 py-2 align-top text-center">
          <span
            className={`text-xs font-medium ${
              failed
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            {failed ? "Reprovado" : "Aprovado"}
          </span>
        </td>
        <td
          className="px-3 py-2 align-top"
          onClick={(e) => e.stopPropagation()}
        >
          {failed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={exporting}
              onClick={handleExport}
            >
              <Download className="mr-1 size-3" />
              Exportar para golden set
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className={failed ? "bg-red-500/5" : "bg-muted/20"}>
          <td />
          <td colSpan={6} className="px-3 pb-3 pt-1">
            <div className="space-y-1 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Raciocinio do judge
              </p>
              <p className="text-sm">
                {result.reasoning ?? "Sem raciocinio disponivel."}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function EvalResultTable({ run, agentId }: EvalResultTableProps) {
  const results = run.results ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2 text-left font-medium">Entrada</th>
            <th className="px-3 py-2 text-left font-medium">Esperado</th>
            <th className="px-3 py-2 text-left font-medium">Real</th>
            <th className="px-3 py-2 text-center font-medium">Score</th>
            <th className="px-3 py-2 text-center font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                Nenhum resultado disponivel.
              </td>
            </tr>
          ) : (
            results.map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                agentId={agentId}
                setId={run.set_id}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
