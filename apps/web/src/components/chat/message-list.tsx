import { useRef, useEffect, useCallback, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble, type ChatMessage } from "./message-bubble";
import { TraceDrawer } from "@/components/traces/trace-drawer";
import { OperatorMessage } from "@/components/conversations/operator-message";

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent?: string;
  sessionId?: string;
}

export function MessageList({ messages, streamingContent, sessionId }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottomRef = useRef(true);
  const [traceOpen, setTraceOpen] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isNearBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when new content arrives (if user is near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, streamingContent]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-4 py-4"
        onScroll={checkScroll}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((msg, i) =>
            msg.metadata?.operator === true ? (
              <OperatorMessage key={i} message={msg} />
            ) : (
              <MessageBubble
                key={i}
                message={msg}
                sessionId={sessionId}
                messageId={msg.id}
                onTrace={() => setTraceOpen(true)}
              />
            )
          )}

          {streamingContent !== undefined && (
            <MessageBubble
              message={{ role: "assistant", content: streamingContent }}
              isStreaming
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showScrollBtn && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 left-1/2 z-10 size-8 -translate-x-1/2 rounded-full shadow-md"
          onClick={scrollToBottom}
        >
          <ArrowDown className="size-4" />
        </Button>
      )}

      {sessionId && (
        <TraceDrawer
          type="conversation"
          id={sessionId}
          open={traceOpen}
          onClose={() => setTraceOpen(false)}
        />
      )}
    </div>
  );
}
