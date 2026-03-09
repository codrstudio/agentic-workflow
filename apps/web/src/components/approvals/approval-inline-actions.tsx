import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { request } from "@/lib/api";
import { pendingApprovalsQueryOptions } from "@/api/approvals";
import { useSSEEvent } from "@/hooks/use-sse";

type DecisionState = "pending" | "approved" | "rejected";

interface InlineApprovalProps {
  approvalId: number;
  actionLabel: string;
}

function InlineApprovalCard({ approvalId, actionLabel }: InlineApprovalProps) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<DecisionState>("pending");
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["approvals"] });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      request(`/approval-requests/${approvalId}/approve`, { method: "POST" }),
    onSuccess: () => {
      setDecision("approved");
      toast.success("Acao aprovada");
      onSuccess();
    },
    onError: () => toast.error("Erro ao aprovar"),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      request(`/approval-requests/${approvalId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    onSuccess: () => {
      setDecision("rejected");
      toast.success("Acao rejeitada");
      onSuccess();
    },
    onError: () => toast.error("Erro ao rejeitar"),
  });

  if (decision === "approved") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-green-500" />
        <span>Acao aprovada</span>
      </div>
    );
  }

  if (decision === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
        <X className="h-4 w-4 text-destructive" />
        <span>Acao rejeitada</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
      <p className="text-sm text-muted-foreground">
        Aguardando aprovacao:{" "}
        <span className="font-medium text-foreground">{actionLabel}</span>
      </p>

      {showReject ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-20 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              Confirmar rejeicao
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReject(true)}
          >
            <X className="mr-1.5 h-4 w-4" />
            Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}

interface PendingApproval {
  approvalId: number;
  actionLabel: string;
}

interface Props {
  sessionId: string;
}

export function ApprovalInlineActions({ sessionId }: Props) {
  const queryClient = useQueryClient();
  const [sseApprovals, setSseApprovals] = useState<PendingApproval[]>([]);

  const { data: pendingFromServer } = useQuery(pendingApprovalsQueryOptions());

  useSSEEvent("approval:pending", (event) => {
    const data = event.data as {
      approvalId?: number;
      sessionId?: string;
      actionLabel?: string;
    } | undefined;
    if (
      data?.approvalId != null &&
      data.sessionId === sessionId &&
      data.actionLabel
    ) {
      setSseApprovals((prev) => {
        if (prev.some((a) => a.approvalId === data.approvalId)) return prev;
        return [
          ...prev,
          { approvalId: data.approvalId!, actionLabel: data.actionLabel! },
        ];
      });
      queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
    }
  });

  // Merge SSE-triggered approvals with server pending (filter by session_id)
  const serverForSession = (pendingFromServer ?? [])
    .filter((a) => a.session_id === sessionId)
    .map((a) => ({ approvalId: a.id, actionLabel: a.action_label }));

  const merged = [...serverForSession];
  for (const sse of sseApprovals) {
    if (!merged.some((a) => a.approvalId === sse.approvalId)) {
      merged.push(sse);
    }
  }

  if (merged.length === 0) return null;

  return (
    <div className="space-y-2 px-4 py-2">
      {merged.map((approval) => (
        <InlineApprovalCard
          key={approval.approvalId}
          approvalId={approval.approvalId}
          actionLabel={approval.actionLabel}
        />
      ))}
    </div>
  );
}
