import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { MemorySearchResult } from "@/api/agents";

interface MemorySearchResultItemProps {
  result: MemorySearchResult;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function MemorySearchResultItem({ result }: MemorySearchResultItemProps) {
  const [expanded, setExpanded] = useState(false);
  const scorePercent = Math.round(result.score * 100);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">{getFileName(result.path)}</Badge>
        <Badge variant="outline">
          {result.source === "vector" ? "vetor" : "texto"}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {scorePercent}%
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left text-sm text-foreground cursor-pointer"
      >
        <p className={expanded ? "" : "line-clamp-3"}>{result.snippet}</p>
      </button>

      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface MemorySearchResultListProps {
  results: MemorySearchResult[];
}

export function MemorySearchResultList({
  results,
}: MemorySearchResultListProps) {
  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum resultado encontrado
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result, i) => (
        <MemorySearchResultItem key={`${result.path}-${i}`} result={result} />
      ))}
    </div>
  );
}
