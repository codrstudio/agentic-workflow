import { Shield } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useACRContext } from "@/hooks/use-acrs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ACRPipelineBadgeProps {
  projectSlug: string;
}

export function ACRPipelineBadge({ projectSlug }: ACRPipelineBadgeProps) {
  const { data } = useACRContext(projectSlug);

  if (!data) return null;

  const activeCount = data.acrs.length;
  const openViolations = data.violations_summary.open;
  const slugs = data.acrs.map((a) => a.slug).join(", ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/projects/$projectId/artifacts/acrs"
          params={{ projectId: projectSlug }}
          className="inline-flex items-center gap-1.5 no-underline"
        >
          <Badge variant="secondary" className="gap-1 cursor-pointer">
            <Shield className="h-3 w-3" />
            ACRs ativas: {activeCount}
          </Badge>
          {openViolations > 0 && (
            <Badge variant="destructive" className="cursor-pointer">
              {openViolations} {openViolations === 1 ? "violacao" : "violacoes"}
            </Badge>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>
          {activeCount > 0
            ? `Active ACRs: ${slugs}`
            : "No active ACRs"}
        </p>
        {openViolations > 0 && (
          <p className="mt-1">
            {openViolations} open {openViolations === 1 ? "violation" : "violations"}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
