import { useState } from "react";
import { User, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/components/chat/message-bubble";

interface OperatorMessageProps {
  message: ChatMessage;
}

export function OperatorMessage({ message }: OperatorMessageProps) {
  const [copied, setCopied] = useState(false);
  const operatorSlug =
    typeof message.metadata?.operatorSlug === "string"
      ? message.metadata.operatorSlug
      : "Operador";

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group flex w-full justify-start">
      <div className="relative max-w-[85%]">
        <div className="mb-1 flex items-center gap-1.5">
          <User className="size-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">{operatorSlug}</span>
          <Badge variant="outline" className="h-4 border-primary/40 px-1 py-0 text-[10px] text-primary">
            Operador
          </Badge>
        </div>
        <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.content && (
          <div className="absolute -top-3 -right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
