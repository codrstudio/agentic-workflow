import { useState, useRef, useCallback } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth";

interface DraftChatPanelProps {
  agentId: string;
  draftId: string;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE_PATH = "/api/v1/ai";

export function DraftChatPanel({ agentId, draftId, onClose }: DraftChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    abortRef.current = new AbortController();
    setStreaming(true);

    const token = useAuthStore.getState().token;

    try {
      const res = await fetch(
        `${BASE_PATH}/agents/${agentId}/drafts/${draftId}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: text }),
          signal: abortRef.current.signal,
        },
      );

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erro: ${res.status}` },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as { type: string; content?: string };
            if (event.type === "text" && event.content) {
              assistantText += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                  };
                }
                return updated;
              });
            }
          } catch {
            // ignore malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Erro ao conectar ao rascunho." },
        ]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [agentId, draftId, input, streaming]);

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium">Chat com rascunho</h3>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8">
            Envie uma mensagem para testar o rascunho.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content || (streaming && msg.role === "assistant" ? "..." : "")}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t flex gap-2">
        <Input
          placeholder="Mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={streaming}
        />
        <Button size="icon" onClick={sendMessage} disabled={streaming || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
