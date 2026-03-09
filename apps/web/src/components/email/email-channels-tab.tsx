import { useQuery } from "@tanstack/react-query";
import { Mail, RefreshCw, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { adaptersQueryOptions } from "@/api/adapters";
import { emailAdapterStatusQueryOptions } from "@/api/email";
import type { EmailAdapterStatus } from "@/api/email";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmailStatusCard({
  adapterId,
  adapterName,
  agentId,
}: {
  adapterId: string;
  adapterName: string;
  agentId: string;
}) {
  const { data: status, isLoading } = useQuery(emailAdapterStatusQueryOptions(adapterId));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="font-medium text-sm truncate">{adapterName}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{adapterId}</p>
          </div>
          <PollingBadge status={status} isLoading={isLoading} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <StatusDetails status={status} />
        )}

        <Link
          to="/agents/$id"
          params={{ id: agentId }}
          search={{ tab: "conversations" }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
        >
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Ver conversas de email
        </Link>
      </CardContent>
    </Card>
  );
}

function PollingBadge({
  status,
  isLoading,
}: {
  status?: EmailAdapterStatus;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-5 w-16 rounded-full" />;
  if (!status) return null;

  return status.polling ? (
    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Polling ativo
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-xs gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
      Inativo
    </Badge>
  );
}

function StatusDetails({ status }: { status?: EmailAdapterStatus }) {
  if (!status) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        Sem dados de status
      </div>
    );
  }

  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>Ultima execucao:</span>
        <span className="font-medium text-foreground">{formatDate(status.lastPollAt)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Emails hoje (24h):</span>
        <span className="font-medium text-foreground">{status.processedToday}</span>
      </div>
      {status.lastError && (
        <div className="flex items-start gap-1.5 text-destructive mt-2 rounded-md bg-destructive/10 p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{status.lastError}</span>
        </div>
      )}
      {!status.lastError && status.polling && (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Sem erros recentes</span>
        </div>
      )}
    </div>
  );
}

interface EmailChannelsTabProps {
  agentId: string;
}

export function EmailChannelsTab({ agentId }: EmailChannelsTabProps) {
  const { data: adapters, isLoading } = useQuery(adaptersQueryOptions());

  const emailAdapters = adapters?.filter((a) => a.connector === "email") ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (emailAdapters.length === 0) {
    return (
      <EmptyState
        icon={<Mail />}
        title="Nenhum adapter de email"
        description="Configure um adapter de email em Adaptadores para receber e responder emails automaticamente."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {emailAdapters.length} adapter(s) de email configurado(s). Polling atualiza a cada 30s.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {emailAdapters.map((adapter) => (
          <EmailStatusCard
            key={adapter.slug}
            adapterId={adapter.slug}
            adapterName={adapter.name || adapter.slug}
            agentId={agentId}
          />
        ))}
      </div>
    </div>
  );
}
