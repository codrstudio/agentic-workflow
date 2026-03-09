import { useAuthStore } from "./auth.js";

const BASE_PATH = "/api/v1/ai";

export interface ChatStreamEvent {
  type: "init" | "text" | "result" | "usage";
  content?: string;
  sessionId?: string;
  usage?: Record<string, unknown>;
}

export async function streamMessage(
  sessionId: string,
  content: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().token;

  const res = await fetch(`${BASE_PATH}/conversations/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Stream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const event = JSON.parse(jsonStr) as ChatStreamEvent;
          onEvent(event);
        } catch {
          // ignore malformed JSON
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.startsWith("data:")) {
    const jsonStr = buffer.slice(5).trim();
    if (jsonStr) {
      try {
        const event = JSON.parse(jsonStr) as ChatStreamEvent;
        onEvent(event);
      } catch {
        // ignore
      }
    }
  }
}
