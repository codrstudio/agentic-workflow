import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Bot, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReviewAgents,
  useReviewAgentDefaults,
  useUpdateReviewAgent,
  type ReviewAgent,
} from "@/hooks/use-review-agents-settings";
import type { ReviewAgentType } from "@/hooks/use-agent-review";

function AgentCard({
  agent,
  defaultAgent,
  onToggle,
  onUpdatePrompt,
  onRestore,
  isSaving,
}: {
  agent: ReviewAgent;
  defaultAgent: ReviewAgent | undefined;
  onToggle: (type: ReviewAgentType, enabled: boolean) => void;
  onUpdatePrompt: (type: ReviewAgentType, prompt: string) => void;
  onRestore: (type: ReviewAgentType) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(agent.system_prompt);

  const isModified = defaultAgent
    ? agent.system_prompt !== defaultAgent.system_prompt
    : false;

  const handleSavePrompt = () => {
    onUpdatePrompt(agent.type, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(agent.system_prompt);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={agent.enabled}
          disabled={isSaving}
          onClick={() => onToggle(agent.type, !agent.enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            agent.enabled ? "bg-primary" : "bg-input"
          }`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              agent.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            System Prompt
            {isModified && (
              <span className="ml-1.5 text-yellow-600">(modificado)</span>
            )}
          </label>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setPreview(!preview)}
            >
              {preview ? (
                <EyeOff className="size-3 mr-1" />
              ) : (
                <Eye className="size-3 mr-1" />
              )}
              {preview ? "Editar" : "Preview"}
            </Button>
            {isModified && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                disabled={isSaving}
                onClick={() => onRestore(agent.type)}
              >
                <RotateCcw className="size-3 mr-1" />
                Restaurar default
              </Button>
            )}
          </div>
        </div>

        {preview ? (
          <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap min-h-[80px]">
            {editing ? draft : agent.system_prompt}
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSavePrompt}
                disabled={isSaving || draft === agent.system_prompt}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors min-h-[80px] whitespace-pre-wrap"
            onClick={() => {
              setDraft(agent.system_prompt);
              setEditing(true);
            }}
          >
            {agent.system_prompt}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/settings",
  });

  const { data: agents, isLoading } = useReviewAgents(projectId);
  const { data: defaults } = useReviewAgentDefaults(projectId);
  const updateAgent = useUpdateReviewAgent(projectId);

  const handleToggle = (type: ReviewAgentType, enabled: boolean) => {
    updateAgent.mutate({ type, updates: { enabled } });
  };

  const handleUpdatePrompt = (type: ReviewAgentType, prompt: string) => {
    updateAgent.mutate({ type, updates: { system_prompt: prompt } });
  };

  const handleRestore = (type: ReviewAgentType) => {
    const def = defaults?.find((d) => d.type === type);
    if (def) {
      updateAgent.mutate({
        type,
        updates: { system_prompt: def.system_prompt },
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configuracoes do projeto
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5" />
            <h2 className="text-base font-semibold">Review Agents</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure os agentes de review AI. Habilite ou desabilite agentes e
            customize seus prompts.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {agents?.map((agent) => (
                <AgentCard
                  key={agent.type}
                  agent={agent}
                  defaultAgent={defaults?.find((d) => d.type === agent.type)}
                  onToggle={handleToggle}
                  onUpdatePrompt={handleUpdatePrompt}
                  onRestore={handleRestore}
                  isSaving={updateAgent.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
