import { useRef, useEffect, useCallback } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

const LINE_HEIGHT = 24;
const MIN_LINES = 1;
const MAX_LINES = 5;
const MIN_HEIGHT = LINE_HEIGHT + 16; // 1 line + padding
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES + 16;

export function MessageInput({
  value,
  onChange,
  onSend,
  onAbort,
  isStreaming,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isStreaming) {
        onSend(value);
      }
    }
  }

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="border-t px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          rows={MIN_LINES}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
        />
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="size-9 shrink-0"
            onClick={onAbort}
            aria-label="Parar"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="size-9 shrink-0"
            disabled={!canSend}
            onClick={() => onSend(value)}
            aria-label="Enviar"
          >
            <Send className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
