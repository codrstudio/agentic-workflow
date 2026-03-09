import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Unplug, Wifi, WifiOff } from "lucide-react";
import type { Channel } from "@/api/channels";
import { updateChannel } from "@/api/channels";
import { agentsQueryOptions, type Agent } from "@/api/agents";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { request } from "@/lib/api";

interface ChannelStatusTabProps {
  channel: Channel;
}

export function ChannelStatusTab({ channel }: ChannelStatusTabProps) {
  const queryClient = useQueryClient();
  const { data: agents } = useQuery(agentsQueryOptions());
  const isConnected = Boolean(channel.metadata?.connected);

  const reconnectMutation = useMutation({
    mutationFn: () =>
      request(`/channels/${channel.slug}/reconnect`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channel.slug] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      request(`/channels/${channel.slug}/disconnect`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channel.slug] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string) =>
      updateChannel(channel.slug, {
        metadata: { ...channel.metadata, assignedAgent: agentId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channel.slug] });
    },
  });

  const assignedAgent = (channel.metadata?.assignedAgent as string) ?? "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacoes do Adapter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoRow label="Tipo" value={channel.type} />
            <InfoRow label="Owner" value={channel.owner} />
            <InfoRow label="Listeners" value={String(channel.listeners)} />
            {typeof channel.metadata?.connector === "string" && (
              <InfoRow label="Connector" value={channel.metadata.connector} />
            )}
            {typeof channel.metadata?.phoneNumber === "string" && (
              <InfoRow label="Numero" value={channel.metadata.phoneNumber} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status de Conexao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi className="size-5 text-green-500" />
            ) : (
              <WifiOff className="size-5 text-red-500" />
            )}
            <StatusBadge status={isConnected ? "active" : "inactive"} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? "Canal conectado" : "Canal desconectado"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => reconnectMutation.mutate()}
              disabled={reconnectMutation.isPending}
            >
              <Plug className="mr-1 size-4" />
              {reconnectMutation.isPending ? "Reconectando..." : "Reconectar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unplug className="mr-1 size-4" />
              {disconnectMutation.isPending
                ? "Desconectando..."
                : "Desconectar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atribuicao a Agente</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={assignedAgent}
            onValueChange={(v) => { if (v) assignMutation.mutate(v); }}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecionar agente..." />
            </SelectTrigger>
            <SelectContent>
              {agents?.map((agent: Agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
