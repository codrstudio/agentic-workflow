import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  agentConversationsQueryOptions,
  type Conversation,
} from "@/api/conversations";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

interface AgentConversationsProps {
  agentId: string;
  agentSlug: string;
}

export function AgentConversations({ agentId, agentSlug }: AgentConversationsProps) {
  const navigate = useNavigate();
  const { data: conversations, isLoading } = useQuery(
    agentConversationsQueryOptions(agentId),
  );

  const sorted = useMemo(() => {
    if (!conversations) return [];
    return [...conversations].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [conversations]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <EmptyState
        icon={<MessageSquare />}
        title="Nenhuma conversa"
        description={`Nenhuma conversa encontrada para ${agentSlug}.`}
      />
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((conv) => (
        <ConversationRow
          key={conv.id}
          conversation={conv}
          agentSlug={agentSlug}
          onClick={() =>
            navigate({ to: `/conversations/${conv.id}` as string })
          }
        />
      ))}
    </div>
  );
}

function ConversationRow({
  conversation,
  agentSlug,
  onClick,
}: {
  conversation: Conversation;
  agentSlug: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0 text-xs">
            <Bot className="mr-1 size-3" />
            {agentSlug}
          </Badge>
          <span className="truncate text-sm font-medium">
            {conversation.title || "Sem titulo"}
          </span>
        </div>
        {conversation.lastMessage && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {conversation.lastMessage}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(conversation.updatedAt)}
      </span>
    </button>
  );
}
