import { useMemo } from "react";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-sessions";

function renderMarkdown(content: string): string {
  let html = content
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (```lang\n...\n```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) =>
      `<pre class="my-2 rounded-md bg-background/80 p-3 text-sm overflow-x-auto"><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-background/80 px-1.5 py-0.5 text-sm">$1</code>',
  );

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(
    /(?:^|\n)((?:- .+\n?)+)/g,
    (_match, block: string) => {
      const items = block
        .trim()
        .split("\n")
        .map((line: string) => `<li>${line.replace(/^- /, "")}</li>`)
        .join("");
      return `\n<ul class="my-2 ml-4 list-disc space-y-1">${items}</ul>\n`;
    },
  );

  // Ordered lists
  html = html.replace(
    /(?:^|\n)((?:\d+\. .+\n?)+)/g,
    (_match, block: string) => {
      const items = block
        .trim()
        .split("\n")
        .map((line: string) => `<li>${line.replace(/^\d+\. /, "")}</li>`)
        .join("");
      return `\n<ol class="my-2 ml-4 list-decimal space-y-1">${items}</ol>\n`;
    },
  );

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-3 mb-1">$1</h1>');

  // Paragraphs: double newlines become <p>
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<h1") ||
        trimmed.startsWith("<h2") ||
        trimmed.startsWith("<h3")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

interface MessageBubbleProps {
  message: ChatMessage;
  className?: string;
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const html = useMemo(() => renderMarkdown(message.content), [message.content]);

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10" : "bg-muted",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary/10 text-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <div
          className="prose prose-sm max-w-none dark:prose-invert [&>p]:my-1 [&>pre]:my-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Dots */}
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
