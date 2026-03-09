import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from "react";
import { SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  className?: string;
}

const LINE_HEIGHT = 24; // px per line
const MAX_LINES = 6;
const MIN_HEIGHT = LINE_HEIGHT + 16; // 1 line + padding
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES + 16;

export function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  isStreaming,
  disabled,
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };

  const handleSend = () => {
    if (isStreaming) {
      onCancel?.();
    } else if (value.trim()) {
      onSend();
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
      }
    }
  };

  const canSend = !isStreaming && value.trim().length > 0 && !disabled;

  return (
    <div className={cn("flex items-end gap-2 border-t bg-background p-3", className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Escreva sua mensagem..."
        disabled={isStreaming || disabled}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        )}
        style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={isStreaming ? false : !canSend}
        variant={isStreaming ? "destructive" : "default"}
        className="shrink-0"
        aria-label={isStreaming ? "Cancelar streaming" : "Enviar mensagem"}
      >
        {isStreaming ? (
          <Square className="h-4 w-4" />
        ) : (
          <SendHorizontal className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
