const API_BASE = "/api/v1";

export interface StreamCallbacks {
  onStart?: (messageId: string) => void;
  onDelta: (text: string) => void;
  onComplete: (messageId: string, artifacts: string[]) => void;
  onError: (error: string) => void;
}

export function streamChatMessage(
  projectSlug: string,
  sessionId: string,
  content: string,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController();

  fetch(
    `${API_BASE}/hub/projects/${projectSlug}/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        callbacks.onError(body.error ?? `Request failed: ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              switch (currentEvent) {
                case "message.start":
                  callbacks.onStart?.(data.message_id);
                  break;
                case "message.delta":
                  callbacks.onDelta(data.content);
                  break;
                case "message.complete":
                  callbacks.onComplete(
                    data.message_id,
                    data.artifacts ?? [],
                  );
                  break;
                case "message.error":
                  callbacks.onError(data.error);
                  break;
              }
            } catch {
              // Skip malformed JSON lines
            }
            currentEvent = "";
          }
        }
      }
    })
    .catch((err: Error) => {
      if (err.name === "AbortError") return;
      callbacks.onError(err.message);
    });

  return controller;
}
