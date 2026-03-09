import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleAgentEnabled, triggerHeartbeat } from "@/api/agents";
import { createConversation } from "@/api/conversations";
import type { Agent } from "@/api/agents";

interface AgentActionsProps {
  agent: Agent;
}

export function AgentActions({ agent }: AgentActionsProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [triggering, setTriggering] = useState(false);

  const isHeartbeatOn = agent.enabled && agent.heartbeatEnabled;

  const toggleMutation = useMutation({
    mutationFn: () => toggleAgentEnabled(agent.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const conversationMutation = useMutation({
    mutationFn: () => createConversation(agent.id),
    onSuccess: (conversation) => {
      navigate({ to: `/conversations/${conversation.id}` as string });
    },
  });

  async function handleTrigger() {
    setTriggering(true);
    try {
      await triggerHeartbeat(agent.id);
      queryClient.invalidateQueries({ queryKey: ["agents", agent.id, "heartbeat-history"] });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="heartbeat-toggle"
          checked={isHeartbeatOn}
          onCheckedChange={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
        />
        <Label htmlFor="heartbeat-toggle" className="text-sm">
          Heartbeat
        </Label>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleTrigger}
        disabled={triggering}
      >
        <Play className="size-3.5" />
        {triggering ? "Disparando..." : "Trigger manual"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => conversationMutation.mutate()}
        disabled={conversationMutation.isPending}
      >
        <MessageSquarePlus className="size-3.5" />
        Nova Conversa
      </Button>
    </div>
  );
}
