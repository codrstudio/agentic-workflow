import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateHandoff, deleteHandoff } from "@/api/handoffs";
import type { Handoff } from "@/api/handoffs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HandoffCardProps {
  handoff: Handoff;
  agentId: string;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function HandoffCard({
  handoff,
  agentId,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: HandoffCardProps) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateHandoff(agentId, handoff.id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs", agentId] });
    },
    onError: () => toast.error("Erro ao atualizar handoff"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHandoff(agentId, handoff.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs", agentId] });
      toast.success("Handoff removido");
    },
    onError: () => toast.error("Erro ao remover handoff"),
  });

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-3 transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      <div className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing">
        <GripVertical className="size-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{handoff.label}</span>
          <Badge variant="outline" className="text-xs">
            {handoff.memberId}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            P{handoff.priority}
          </Badge>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {handoff.triggerIntent}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={handoff.enabled}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
          disabled={toggleMutation.isPending}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
