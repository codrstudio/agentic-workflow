import { useState } from "react";
import Markdown from "react-markdown";
import { Copy, Check, Activity, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StreamingIndicator } from "./streaming-indicator";
import { MessageFeedback } from "@/components/conversations/message-feedback";

export interface MessageFeedback {
  rating: "up" | "down";
  reason: string | null;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  feedback?: MessageFeedback;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  sessionId?: string;
  onTrace?: (sessionId: string) => void;
  messageId?: string;
}

export function MessageBubble({ message, isStreaming, sessionId, onTrace, messageId }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "group flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Markdown>{message.content}</Markdown>
            {isStreaming && <StreamingIndicator />}
          </div>
        )}

        {!isUser && Boolean(message.metadata?.agentId) && (
          <div className="mt-1.5">
            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
              <Bot className="size-2.5" />
              {message.metadata?.agentId as string}
            </Badge>
          </div>
        )}

        {!isStreaming && message.content && (
          <div
            className={cn(
              "absolute -top-3 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "-left-2" : "-right-2",
            )}
          >
            {!isUser && sessionId && onTrace && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title="Ver trace"
                onClick={() => onTrace(sessionId)}
              >
                <Activity className="size-3" />
              </Button>
            )}
            {!isUser && sessionId && messageId && (
              <MessageFeedback
                sessionId={sessionId}
                messageId={messageId}
                feedback={message.feedback}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
