import { Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PipelinePhase } from "@/components/pipeline-stepper";

export type CognitivePhaseId =
  | "brainstorming"
  | "specs"
  | "prps"
  | "implementation"
  | "review";

interface CognitivePhaseConfig {
  label: string;
  mode: string;
  description: string;
  color: string;
}

const COGNITIVE_PHASES: Record<CognitivePhaseId, CognitivePhaseConfig> = {
  brainstorming: {
    label: "Brainstorming",
    mode: "Divergencia",
    description:
      "Modo divergente: exploracao ampla de ideias, dores e oportunidades. Pensamento lateral sem julgamento.",
    color:
      "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  },
  specs: {
    label: "Specs",
    mode: "Convergencia",
    description:
      "Modo convergente: filtragem e estruturacao das ideias em especificacoes tecnicas concretas.",
    color:
      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  },
  prps: {
    label: "PRPs",
    mode: "Operacional",
    description:
      "Modo operacional: decomposicao das specs em planos de execucao com features, dependencias e prioridades.",
    color:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  },
  implementation: {
    label: "Implementation",
    mode: "Execucao",
    description:
      "Modo execucao: codificacao focada, uma feature por vez. Ciclo rapido de implementar, testar, iterar.",
    color:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  },
  review: {
    label: "Review",
    mode: "Verificacao",
    description:
      "Modo verificacao: validacao de qualidade, revisao de codigo, testes de integracao e documentacao.",
    color:
      "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700",
  },
};

export function deriveCognitivePhase(
  phases: PipelinePhase[],
): CognitivePhaseId {
  const allComplete = phases.every((p) => p.status === "complete");
  if (allComplete) return "review";

  const inProgress = phases.find((p) => p.status === "in_progress");
  if (inProgress) {
    const phaseMap: Record<string, CognitivePhaseId> = {
      "1-brainstorming": "brainstorming",
      "2-specs": "specs",
      "3-prps": "prps",
      features: "implementation",
    };
    return phaseMap[inProgress.id] ?? "brainstorming";
  }

  const firstComplete = phases.find((p) => p.status === "complete");
  if (firstComplete) {
    const idx = phases.indexOf(firstComplete);
    const nextPhase = phases[idx + 1];
    if (nextPhase) {
      const phaseMap: Record<string, CognitivePhaseId> = {
        "1-brainstorming": "brainstorming",
        "2-specs": "specs",
        "3-prps": "prps",
        features: "implementation",
      };
      return phaseMap[nextPhase.id] ?? "brainstorming";
    }
  }

  return "brainstorming";
}

interface CognitivePhaseIndicatorProps {
  phases: PipelinePhase[];
  className?: string;
}

export function CognitivePhaseIndicator({
  phases,
  className,
}: CognitivePhaseIndicatorProps) {
  const phaseId = deriveCognitivePhase(phases);
  const phase = COGNITIVE_PHASES[phaseId];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 transition-all duration-300 ease-in-out animate-in fade-in-50 cursor-default",
            phase.color,
            className,
          )}
        >
          <Brain className="h-3.5 w-3.5" />
          <span>
            {phase.label} ({phase.mode})
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p>{phase.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
