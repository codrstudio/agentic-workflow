import { useRef, useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Paperclip } from "lucide-react";
import { useSession, sessionKeys } from "@/hooks/use-sessions";
import { useSources } from "@/hooks/use-sources";
import { MessageBubble, TypingIndicator } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { SourceContextSheet } from "@/components/source-context-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { streamChatMessage } from "@/lib/sse-chat";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage } from "@/hooks/use-sessions";

function ChatSessionSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row-reverse gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-24 w-3/4 rounded-2xl" />
      </div>
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
  const { data: sources } = useSources(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync local messages from session data
  useEffect(() => {
    if (session?.messages) {
      setLocalMessages(session.messages);
    }
  }, [session?.messages]);

  // Initialize selected sources from session
  useEffect(() => {
    if (session?.source_ids) {
      setSelectedSourceIds(session.source_ids);
    }
  }, [session?.source_ids]);

  const allMessages = localMessages;
  const hasMessages = allMessages.length > 0 || isStreaming;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, streamingContent]);

  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
      artifacts: [],
    };

    setLocalMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingMessageId(null);

    const controller = streamChatMessage(projectId, sessionId, content, {
      onStart: (messageId) => {
        setStreamingMessageId(messageId);
      },
      onDelta: (text) => {
        setStreamingContent((prev) => prev + text);
      },
      onComplete: (messageId, artifacts) => {
        setStreamingContent((prev) => {
          const assistantMessage: ChatMessage = {
            id: messageId,
            role: "assistant",
            content: prev,
            created_at: new Date().toISOString(),
            artifacts,
          };
          setLocalMessages((msgs) => [...msgs, assistantMessage]);
          return "";
        });
        setIsStreaming(false);
        setStreamingMessageId(null);
        abortControllerRef.current = null;
        // Invalidate session query to sync with server
        queryClient.invalidateQueries({
          queryKey: sessionKeys.detail(projectId, sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: sessionKeys.list(projectId),
        });
      },
      onError: (errorMsg) => {
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingMessageId(null);
        abortControllerRef.current = null;
        // Add error as a system message for visibility
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: `Erro: ${errorMsg}`,
          created_at: new Date().toISOString(),
          artifacts: [],
        };
        setLocalMessages((prev) => [...prev, errorMessage]);
      },
    });

    abortControllerRef.current = controller;
  }, [inputValue, isStreaming, projectId, sessionId, queryClient]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    // Keep whatever content was streamed so far
    if (streamingContent) {
      const partialMessage: ChatMessage = {
        id: streamingMessageId ?? crypto.randomUUID(),
        role: "assistant",
        content: streamingContent + "\n\n*(streaming cancelado)*",
        created_at: new Date().toISOString(),
        artifacts: [],
      };
      setLocalMessages((prev) => [...prev, partialMessage]);
    }
    setIsStreaming(false);
    setStreamingContent("");
    setStreamingMessageId(null);
  }, [streamingContent, streamingMessageId]);

  const handleBack = () => {
    navigate({
      to: "/projects/$projectId/chat",
      params: { projectId },
    });
  };

  const selectedSourceNames = (sources ?? []).filter((s) =>
    selectedSourceIds.includes(s.id),
  );

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
          <div className="flex items-center gap-2">
            {session && (
              <p className="text-xs text-muted-foreground">
                {allMessages.length} {allMessages.length === 1 ? "mensagem" : "mensagens"}
              </p>
            )}
            {selectedSourceNames.length > 0 && (
              <div className="flex items-center gap-1">
                {selectedSourceNames.slice(0, 2).map((s) => (
                  <Badge key={s.id} variant="secondary" className="text-[10px]">
                    {s.name}
                  </Badge>
                ))}
                {selectedSourceNames.length > 2 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{selectedSourceNames.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSourceSheetOpen(true)}
          className="shrink-0"
          aria-label="Selecionar sources de contexto"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
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
          </div>
        )}

        {/* Message list */}
        {(allMessages.length > 0 || isStreaming) && (
          <div className="flex flex-col gap-4 p-4">
            {allMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming message being composed */}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  id: streamingMessageId ?? "streaming",
                  role: "assistant",
                  content: streamingContent,
                  created_at: new Date().toISOString(),
                  artifacts: [],
                }}
              />
            )}

            {/* Typing indicator when streaming hasn't produced content yet */}
            {isStreaming && !streamingContent && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}

        {!hasMessages && <div ref={messagesEndRef} />}
      </div>

      {/* Chat Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onCancel={handleCancel}
        isStreaming={isStreaming}
        disabled={isLoading || isError}
      />

      {/* Source Context Sheet */}
      <SourceContextSheet
        open={sourceSheetOpen}
        onOpenChange={setSourceSheetOpen}
        sources={sources ?? []}
        selectedIds={selectedSourceIds}
        onSelectionChange={setSelectedSourceIds}
      />
    </div>
  );
}
