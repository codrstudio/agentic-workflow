import { Badge } from "@/components/ui/badge";

interface EvalScoreBadgeProps {
  score?: number | null;
}

export function EvalScoreBadge({ score }: EvalScoreBadgeProps) {
  if (score == null) {
    return <Badge variant="outline">—</Badge>;
  }

  if (score >= 0.8) {
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/20">
        {(score * 100).toFixed(0)}%
      </Badge>
    );
  }

  if (score >= 0.5) {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/20">
        {(score * 100).toFixed(0)}%
      </Badge>
    );
  }

  return (
    <Badge className="bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/20">
      {(score * 100).toFixed(0)}%
    </Badge>
  );
}
