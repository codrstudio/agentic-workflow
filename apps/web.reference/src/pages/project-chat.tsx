import { useParams, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";
import { useSessions, useCreateSession } from "@/hooks/use-sessions";
import {
  SessionCard,
  SessionListSkeleton,
  groupSessionsByDate,
} from "@/components/session-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function ProjectChatPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/chat",
  });
  const { data: sessions, isLoading, isError, error } = useSessions(projectId);
  const createSession = useCreateSession(projectId);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleNewSession = () => {
    createSession.mutate(
      {},
      {
        onSuccess: (session) => {
          navigate({
            to: "/projects/$projectId/chat/$sessionId",
            params: { projectId, sessionId: session.id },
          });
        },
      },
    );
  };

  const handleSessionClick = (session: { id: string }) => {
    navigate({
      to: "/projects/$projectId/chat/$sessionId",
      params: { projectId, sessionId: session.id },
    });
  };

  const hasSessions = !isLoading && !isError && sessions && sessions.length > 0;
  const hasNoSessions = !isLoading && !isError && sessions && sessions.length === 0;
  const grouped = hasSessions ? groupSessionsByDate(sessions) : [];

  return (
    <div className="relative flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Conversas com assistente AI
          </p>
        </div>
        {!isMobile && (
          <Button
            size="sm"
            onClick={handleNewSession}
            disabled={createSession.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Conversa
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && <SessionListSkeleton />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar sessoes: {error.message}
        </div>
      )}

      {/* Empty State */}
      {hasNoSessions && (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma conversa"
          description="Inicie uma nova conversa com o assistente AI para explorar ideias, tirar duvidas ou gerar conteudo."
          actionLabel="Nova Conversa"
          onAction={handleNewSession}
          className="min-h-[50vh]"
        />
      )}

      {/* Session list grouped by date */}
      {hasSessions && (
        <div className="flex flex-col gap-6">
          {grouped.map(({ group, sessions: groupSessions }) => (
            <div key={group} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h2>
              {groupSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={handleSessionClick}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* FAB for mobile */}
      {isMobile && (
        <button
          type="button"
          onClick={handleNewSession}
          disabled={createSession.isPending}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Nova Conversa"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
