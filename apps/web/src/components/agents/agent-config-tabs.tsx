import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, MessageSquare, Heart, Sparkles, Wrench, Shield, GitBranch } from "lucide-react";
import { agentFileQueryOptions, saveAgentFile } from "@/api/agents";
import type { Agent } from "@/api/agents";
import {
  allSkillsQueryOptions,
  agentSkillsQueryOptions,
  assignSkill,
  unassignSkill,
  allServicesQueryOptions,
  agentServicesQueryOptions,
  assignService,
  unassignService,
} from "@/api/skills";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { HeartbeatConfig } from "@/components/agents/heartbeat-config";
import { AgentAdvancedPanel } from "@/components/agents/agent-advanced-panel";
import { AgentRoutingSettings } from "@/components/routing/agent-routing-settings";
import { ResourceAssigner } from "@/components/shared/resource-assigner";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const subtabs = [
  { value: "identity", label: "Identidade", icon: FileText, kind: "file" as const, filename: "SOUL.md" },
  { value: "conversation", label: "Conversa", icon: MessageSquare, kind: "file" as const, filename: "CONVERSATION.md" },
  { value: "heartbeat", label: "Heartbeat", icon: Heart, kind: "file" as const, filename: "HEARTBEAT.md" },
  { value: "skills", label: "Skills", icon: Sparkles, kind: "resource" as const },
  { value: "tools", label: "Tools", icon: Wrench, kind: "resource" as const },
  { value: "routing", label: "Routing", icon: GitBranch, kind: "routing" as const },
  { value: "advanced", label: "Avancado", icon: Shield, kind: "advanced" as const },
] as const;

type SubtabValue = (typeof subtabs)[number]["value"];

interface AgentConfigTabsProps {
  agentId: string;
  agent: Agent;
  subtab?: string;
}

export function AgentConfigTabs({ agentId, agent, subtab }: AgentConfigTabsProps) {
  const navigate = useNavigate();
  const activeSubtab = (
    subtabs.some((s) => s.value === subtab) ? subtab : "identity"
  ) as SubtabValue;

  const activeConfig = subtabs.find((s) => s.value === activeSubtab)!;

  function handleSubtabChange(value: SubtabValue) {
    navigate({
      to: "/agents/$id",
      params: { id: agentId },
      search: { tab: "config", subtab: value },
      replace: true,
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Vertical sub-tab navigation */}
      <nav className="flex flex-row gap-1 sm:w-48 sm:flex-col sm:border-r sm:pr-4">
        {subtabs.map((s) => (
          <button
            key={s.value}
            onClick={() => handleSubtabChange(s.value)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
              activeSubtab === s.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <s.icon className="size-4 shrink-0" />
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-6">
        {activeConfig.kind === "file" && (
          <>
            <FileEditor
              key={`${agentId}-${activeConfig.filename}`}
              agentId={agentId}
              filename={activeConfig.filename}
            />
            {activeSubtab === "heartbeat" && (
              <>
                <Separator />
                <HeartbeatConfig agentId={agentId} />
              </>
            )}
          </>
        )}
        {activeSubtab === "skills" && (
          <SkillsPanel agentId={agentId} />
        )}
        {activeSubtab === "tools" && (
          <ToolsPanel agentId={agentId} />
        )}
        {activeSubtab === "routing" && (
          <AgentRoutingSettings agentId={agentId} />
        )}
        {activeSubtab === "advanced" && (
          <AgentAdvancedPanel agent={agent} />
        )}
      </div>
    </div>
  );
}

function FileEditor({ agentId, filename }: { agentId: string; filename: string }) {
  const { data, isLoading, isError } = useQuery(agentFileQueryOptions(agentId, filename));

  const [content, setContent] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeNoteRef = useRef(changeNote);

  useEffect(() => {
    changeNoteRef.current = changeNote;
  }, [changeNote]);

  // Sync fetched content to local state once
  useEffect(() => {
    if (data) {
      setContent(data.content);
    } else if (isError) {
      // File doesn't exist yet — start empty
      setContent("");
    }
  }, [data, isError]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveStatus("idle");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveAgentFile(agentId, filename, value, changeNoteRef.current || undefined);
          setSaveStatus("saved");
          savedRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
          setSaveStatus("error");
        }
      }, 2000);
    },
    [agentId, filename],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MarkdownEditor
        value={content ?? ""}
        onChange={handleChange}
        saveStatus={saveStatus}
        placeholder={`Escreva o conteudo de ${filename}...`}
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">
          Nota sobre esta mudanca (opcional)
        </label>
        <input
          type="text"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Ex: Ajuste no tom de comunicacao"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

function SkillsPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data: allSkills, isLoading: loadingAll } = useQuery(allSkillsQueryOptions());
  const { data: agentSkills, isLoading: loadingAgent } = useQuery(agentSkillsQueryOptions(agentId));

  const assignMutation = useMutation({
    mutationFn: ({ slug, sourceScope }: { slug: string; sourceScope: string }) =>
      assignSkill(agentId, slug, sourceScope),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "skills"] });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (slug: string) => unassignSkill(agentId, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "skills"] });
    },
  });

  return (
    <ResourceAssigner
      available={allSkills ?? []}
      assigned={agentSkills ?? []}
      onAssign={(slug, sourceScope) => assignMutation.mutate({ slug, sourceScope })}
      onUnassign={(slug) => unassignMutation.mutate(slug)}
      loading={loadingAll || loadingAgent}
    />
  );
}

function ToolsPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data: allServices, isLoading: loadingAll } = useQuery(allServicesQueryOptions());
  const { data: agentServices, isLoading: loadingAgent } = useQuery(agentServicesQueryOptions(agentId));

  const assignMutation = useMutation({
    mutationFn: ({ slug, sourceScope }: { slug: string; sourceScope: string }) =>
      assignService(agentId, slug, sourceScope),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "services"] });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (slug: string) => unassignService(agentId, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "services"] });
    },
  });

  return (
    <ResourceAssigner
      available={allServices ?? []}
      assigned={agentServices ?? []}
      onAssign={(slug, sourceScope) => assignMutation.mutate({ slug, sourceScope })}
      onUnassign={(slug) => unassignMutation.mutate(slug)}
      loading={loadingAll || loadingAgent}
    />
  );
}
