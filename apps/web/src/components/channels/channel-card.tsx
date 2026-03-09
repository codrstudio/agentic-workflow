import { MessageSquare, Phone, PhoneCall } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Channel } from "@/api/channels";

interface ChannelCardProps {
  channel: Channel;
  onClick: () => void;
}

const typeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  chat: { label: "Chat", icon: MessageSquare },
  whatsapp: { label: "WhatsApp", icon: Phone },
  voice: { label: "Voz", icon: PhoneCall },
};

function getTypeConfig(type: string) {
  return typeConfig[type] ?? { label: type, icon: MessageSquare };
}

export function ChannelCard({ channel, onClick }: ChannelCardProps) {
  const config = getTypeConfig(channel.type);
  const Icon = config.icon;
  const connected = Boolean(channel.metadata?.connected);

  return (
    <Card
      className="cursor-pointer transition-colors hover:ring-foreground/20"
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          {channel.slug}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {config.label}
          </Badge>
          <StatusBadge status={connected ? "active" : "inactive"} label={connected ? "Conectado" : "Desconectado"} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{channel.owner}</span>
          <span>{channel.listeners} {channel.listeners === 1 ? "listener" : "listeners"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
