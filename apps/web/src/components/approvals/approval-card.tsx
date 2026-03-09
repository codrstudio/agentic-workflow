import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { request } from "@/lib/api";
import type { ApprovalRequest } from "@/api/approvals";

function useCountdown(expiresAt: string): string {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  if (remaining <= 0) return "Expirado";
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  return `${secs}s`;
}

interface Props {
  approval: ApprovalRequest;
}

export function ApprovalCard({ approval }: Props) {
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const countdown = useCountdown(approval.expires_at);

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["approvals"] });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      request(`/approval-requests/${approval.id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acao aprovada");
      onSuccess();
    },
    onError: () => toast.error("Erro ao aprovar"),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      request(`/approval-requests/${approval.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    onSuccess: () => {
      toast.success("Acao rejeitada");
      onSuccess();
    },
    onError: () => toast.error("Erro ao rejeitar"),
  });

  const isExpired = countdown === "Expirado";
  const isPending = approval.status === "pending" && !isExpired;

  let payload: unknown;
  try {
    payload = JSON.parse(approval.payload);
  } catch {
    payload = approval.payload;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">{approval.action_label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{approval.agent_id}</p>
          </div>
          <Badge
            variant={isExpired ? "secondary" : "destructive"}
            className="shrink-0 tabular-nums"
          >
            {countdown}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ver detalhes */}
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Ver detalhes
        </button>
        {showDetails && (
          <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}

        {/* Reject input */}
        {showReject && (
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
        )}

        {/* Actions */}
        {isPending && !showReject && (
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
        {isExpired && (
          <p className="text-xs text-muted-foreground">Esta solicitacao expirou.</p>
        )}
      </CardContent>
    </Card>
  );
}
