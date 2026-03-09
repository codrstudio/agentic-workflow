import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  FeedbackReasonPopover,
  type FeedbackReason,
} from "./feedback-reason-popover";
import type { MessageFeedback as FeedbackState } from "@/components/chat/message-bubble";

interface MessageFeedbackProps {
  sessionId: string;
  messageId: string;
  feedback?: FeedbackState;
}

export function MessageFeedback({
  sessionId,
  messageId,
  feedback: initialFeedback,
}: MessageFeedbackProps) {
  const queryClient = useQueryClient();
  const [localFeedback, setLocalFeedback] = useState<FeedbackState | null>(
    initialFeedback ?? null
  );
  const [downPopoverOpen, setDownPopoverOpen] = useState(false);

  const activeRating = localFeedback?.rating ?? null;

  const postMutation = useMutation({
    mutationFn: (body: { rating: "up" | "down"; reason?: string }) =>
      request(`/conversations/${sessionId}/messages/${messageId}/feedback`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      setLocalFeedback({ rating: vars.rating, reason: vars.reason ?? null });
      queryClient.invalidateQueries({
        queryKey: ["conversations", sessionId, "messages"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      request(`/conversations/${sessionId}/messages/${messageId}/feedback`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setLocalFeedback(null);
      queryClient.invalidateQueries({
        queryKey: ["conversations", sessionId, "messages"],
      });
    },
  });

  function handleThumbsUp() {
    if (activeRating === "up") {
      deleteMutation.mutate();
    } else {
      postMutation.mutate({ rating: "up" });
    }
  }

  function handleReasonSelect(reason: FeedbackReason) {
    postMutation.mutate({ rating: "down", reason });
  }

  function handleThumbsDownClick() {
    if (activeRating === "down") {
      deleteMutation.mutate();
    } else {
      setDownPopoverOpen(true);
    }
  }

  const isPending = postMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-6",
          activeRating === "up" && "text-green-600 hover:text-green-600"
        )}
        disabled={isPending}
        onClick={handleThumbsUp}
        title="Boa resposta"
      >
        <ThumbsUp
          className={cn(
            "size-3",
            activeRating === "up" ? "fill-current" : "fill-none"
          )}
        />
      </Button>

      <FeedbackReasonPopover
        open={downPopoverOpen}
        onOpenChange={setDownPopoverOpen}
        onSelect={handleReasonSelect}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-6",
            activeRating === "down" && "text-destructive hover:text-destructive"
          )}
          disabled={isPending}
          onClick={handleThumbsDownClick}
          title="Resposta ruim"
        >
          <ThumbsDown
            className={cn(
              "size-3",
              activeRating === "down" ? "fill-current" : "fill-none"
            )}
          />
        </Button>
      </FeedbackReasonPopover>
    </div>
  );
}
