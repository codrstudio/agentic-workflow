import { useRef, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useSession } from "@/hooks/use-sessions";
import { MessageBubble, TypingIndicator } from "@/components/message-bubble";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";

function ChatSessionSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* User message skeleton (right) */}
      <div className="flex flex-row-reverse gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
      </div>
      {/* Assistant message skeleton (left) */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-24 w-3/4 rounded-2xl" />
      </div>
      {/* Another user */}
      <div className="flex flex-row-reverse gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-12 w-1/2 rounded-2xl" />
      </div>
    </div>
  );
}

export function ChatSessionPage() {
  const { projectId, sessionId } = useParams({
    from: "/_authenticated/projects/$projectId/chat/$sessionId",
  });
  const { data: session, isLoading, isError, error } = useSession(projectId, sessionId);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];
  const hasMessages = messages.length > 0;
  // Streaming state will be managed by F-025 (ChatInput & streaming controls)
  // For now we expose the typing indicator for when it's integrated
  const isStreaming = false;

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  const handleBack = () => {
    navigate({
      to: "/projects/$projectId/chat",
      params: { projectId },
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {session?.title ?? "Carregando..."}
          </h2>
          {session && (
            <p className="text-xs text-muted-foreground">
              {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
            </p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {isLoading && <ChatSessionSkeleton />}

        {isError && (
          <div className="p-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Falha ao carregar sessao: {error.message}
            </div>
          </div>
        )}

        {/* New session - no messages yet */}
        {!isLoading && !isError && !hasMessages && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">
                Nova conversa
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Envie uma mensagem para comecar a conversar com o assistente.
              </p>
            </div>
            <div className="w-full max-w-lg">
              <Input
                placeholder="Digite sua mensagem..."
                className="text-center"
                disabled
                aria-label="Mensagem (use o input abaixo)"
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Use o campo de entrada abaixo para enviar mensagens
              </p>
            </div>
          </div>
        )}

        {/* Message list */}
        {hasMessages && (
          <div className="flex flex-col gap-4 p-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Typing indicator during streaming */}
            {isStreaming && <TypingIndicator />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll anchor for empty state too */}
        {!hasMessages && <div ref={messagesEndRef} />}
      </div>
    </div>
  );
}
