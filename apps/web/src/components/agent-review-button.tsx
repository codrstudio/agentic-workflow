import { useState, useRef, useEffect } from "react";
import { Bot, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useReviewAgentsConfig,
  useAgentReview,
} from "@/hooks/use-agent-review";

type ReviewAgentType = "correctness" | "security" | "performance" | "standards";

const AGENT_LABELS: Record<ReviewAgentType, string> = {
  correctness: "Correctness",
  security: "Security",
  performance: "Performance",
  standards: "Standards",
};

export function AgentReviewButton({
  projectSlug,
  reviewId,
}: {
  projectSlug: string;
  reviewId: string;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<ReviewAgentType>>(
    new Set()
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: agentsConfig } = useReviewAgentsConfig(projectSlug);
  const { state, totalFindings, requestReview, isRunning } = useAgentReview(
    projectSlug,
    reviewId
  );

  // Initialize selected agents from config (enabled agents)
  useEffect(() => {
    if (agentsConfig && selectedAgents.size === 0) {
      const enabled = agentsConfig
        .filter((a) => a.enabled)
        .map((a) => a.type as ReviewAgentType);
      setSelectedAgents(new Set(enabled));
    }
  }, [agentsConfig, selectedAgents.size]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const toggleAgent = (type: ReviewAgentType) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleRun = () => {
    if (selectedAgents.size === 0) return;
    requestReview.mutate([...selectedAgents]);
    setDropdownOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "gap-1.5 h-8",
          state === "completed" && totalFindings > 0 && "border-primary"
        )}
        onClick={() => {
          if (!isRunning) setDropdownOpen((prev) => !prev);
        }}
        disabled={isRunning}
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">AI Review</span>
        {state === "completed" && totalFindings > 0 && (
          <Badge
            variant="secondary"
            className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-semibold bg-primary text-primary-foreground"
          >
            {totalFindings}
          </Badge>
        )}
        {!isRunning && <ChevronDown className="h-3 w-3 ml-0.5" />}
      </Button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-2 shadow-md">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
            Selecionar agentes
          </div>
          {(
            ["correctness", "security", "performance", "standards"] as const
          ).map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedAgents.has(type)}
                onCheckedChange={() => toggleAgent(type)}
              />
              <span className="text-sm">{AGENT_LABELS[type]}</span>
            </label>
          ))}
          <div className="mt-2 border-t pt-2">
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleRun}
              disabled={selectedAgents.size === 0}
            >
              <Bot className="h-3 w-3 mr-1" />
              Executar Review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
