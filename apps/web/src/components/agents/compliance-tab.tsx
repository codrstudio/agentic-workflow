import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  Save,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  complianceSummaryQueryOptions,
  complianceChecklistQueryOptions,
  complianceReportsQueryOptions,
  updateClassification,
  updateChecklistItem,
  generateReport,
  explainDecision,
} from "@/api/compliance";
import type {
  RiskLevel,
  ChecklistStatus,
  ChecklistCategory,
  ReportType,
  ComplianceChecklistItem,
  DecisionExplanation,
} from "@/api/compliance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ComplianceTabProps {
  agentId: string;
}

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: "Alto risco",
  limited: "Risco limitado",
  minimal: "Risco mínimo",
};

const RISK_LEVEL_BADGE_VARIANT: Record<
  RiskLevel,
  "destructive" | "secondary" | "outline"
> = {
  high: "destructive",
  limited: "secondary",
  minimal: "outline",
};

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  transparency: "Transparência",
  oversight: "Supervisão Humana",
  documentation: "Documentação",
  data_governance: "Governança de Dados",
  risk_management: "Gestão de Riscos",
};

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  pending: "Pendente",
  compliant: "Conforme",
  non_compliant: "Não conforme",
  not_applicable: "N/A",
};

const STATUS_BADGE_VARIANT: Record<
  ChecklistStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  compliant: "default",
  non_compliant: "destructive",
  not_applicable: "outline",
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  audit: "Auditoria",
  dpia: "DPIA",
  human_oversight: "Supervisão Humana",
  decision_explanation: "Explicação de Decisão",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function CategoryProgress({
  items,
}: {
  items: ComplianceChecklistItem[];
}) {
  const compliant = items.filter((i) => i.status === "compliant").length;
  const total = items.filter((i) => i.status !== "not_applicable").length;
  const pct = total === 0 ? 0 : Math.round((compliant / total) * 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
        {compliant}/{total === 0 ? items.length : total}
      </span>
    </div>
  );
}

function ChecklistItemRow({
  item,
  agentId,
}: {
  item: ComplianceChecklistItem;
  agentId: string;
}) {
  const queryClient = useQueryClient();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceText, setEvidenceText] = useState(item.evidence ?? "");

  const mutation = useMutation({
    mutationFn: (body: { status: ChecklistStatus; evidence?: string }) =>
      updateChecklistItem(agentId, item.itemKey, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", agentId, "checklist"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", agentId] });
      toast.success("Item atualizado");
    },
    onError: () => toast.error("Erro ao atualizar item"),
  });

  function cycleStatus() {
    const order: ChecklistStatus[] = ["pending", "compliant", "non_compliant", "not_applicable"];
    const idx = order.indexOf(item.status);
    const next = order[(idx + 1) % order.length]!;
    mutation.mutate({ status: next, evidence: evidenceText || undefined });
  }

  function saveEvidence() {
    mutation.mutate({ status: item.status, evidence: evidenceText || undefined });
    setEvidenceOpen(false);
  }

  return (
    <div className="py-3 px-4 space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={cycleStatus}
          disabled={mutation.isPending}
          className="shrink-0"
          title="Clique para mudar status"
        >
          <Badge
            variant={STATUS_BADGE_VARIANT[item.status]}
            className="cursor-pointer text-xs whitespace-nowrap"
          >
            {STATUS_LABELS[item.status]}
          </Badge>
        </button>
        <span className="flex-1 text-sm">{item.itemLabel}</span>
        <button
          onClick={() => setEvidenceOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Editar evidência"
        >
          {evidenceOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
      </div>

      {/* Inline evidence field */}
      {evidenceOpen && (
        <div className="ml-[70px] space-y-2">
          <Textarea
            rows={2}
            placeholder="Descreva a evidência de conformidade…"
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
            className="text-xs resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={saveEvidence}
              disabled={mutation.isPending}
            >
              <Save className="mr-1 size-3" />
              Salvar evidência
            </Button>
            {item.evidence && (
              <p className="text-xs text-muted-foreground self-center">
                Atual: {item.evidence}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ComplianceTab({ agentId }: ComplianceTabProps) {
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useQuery(
    complianceSummaryQueryOptions(agentId),
  );
  const { data: checklist, isLoading: checklistLoading } = useQuery(
    complianceChecklistQueryOptions(agentId),
  );
  const { data: reports, isLoading: reportsLoading } = useQuery(
    complianceReportsQueryOptions(agentId),
  );

  // Risk classification form
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">("");
  const [riskJustification, setRiskJustification] = useState("");
  const [reviewDueAt, setReviewDueAt] = useState("");

  const classification = summary?.classification;

  const classifyMutation = useMutation({
    mutationFn: () =>
      updateClassification(agentId, {
        riskLevel: (riskLevel || classification?.riskLevel || "minimal") as RiskLevel,
        riskJustification: riskJustification || undefined,
        reviewDueAt: reviewDueAt || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", agentId] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "overview"] });
      toast.success("Classificação atualizada");
      setRiskLevel("");
      setRiskJustification("");
      setReviewDueAt("");
    },
    onError: () => toast.error("Erro ao classificar agente"),
  });

  // Generate report
  const [reportType, setReportType] = useState<ReportType>("audit");
  const [reportPeriodFrom, setReportPeriodFrom] = useState("");
  const [reportPeriodTo, setReportPeriodTo] = useState("");

  const reportMutation = useMutation({
    mutationFn: () =>
      generateReport(agentId, {
        reportType,
        periodFrom: reportPeriodFrom || undefined,
        periodTo: reportPeriodTo || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", agentId, "reports"] });
      toast.success("Relatório gerado com sucesso");
    },
    onError: () => toast.error("Erro ao gerar relatório"),
  });

  // Explainability
  const [traceType, setTraceType] = useState("heartbeat");
  const [traceId, setTraceId] = useState("");
  const [explanation, setExplanation] = useState<DecisionExplanation | null>(null);

  const explainMutation = useMutation({
    mutationFn: () => explainDecision(agentId, { traceType, traceId }),
    onSuccess: (data) => {
      setExplanation(data);
      toast.success("Explicação gerada");
    },
    onError: () => toast.error("Trace não encontrado ou sem dados"),
  });

  // Group checklist by category
  const byCategory = checklist
    ? checklist.reduce<Record<string, ComplianceChecklistItem[]>>((acc, item) => {
        (acc[item.category] ??= []).push(item);
        return acc;
      }, {})
    : {};

  if (summaryLoading) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const currentLevel = classification?.riskLevel;
  const checkSummary = summary?.checklistSummary;

  return (
    <div className="space-y-8 mt-4">
      {/* ── Risk Classification ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Classificação de Risco EU AI Act</h3>
          {currentLevel && (
            <Badge variant={RISK_LEVEL_BADGE_VARIANT[currentLevel]}>
              {RISK_LEVEL_LABELS[currentLevel]}
            </Badge>
          )}
        </div>

        {classification && (
          <div className="rounded-lg border p-4 space-y-2 text-xs text-muted-foreground">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-medium text-foreground">Classificado por</p>
                <p>{classification.classifiedBy}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Data</p>
                <p>{formatDate(classification.classifiedAt)}</p>
              </div>
              {classification.reviewDueAt && (
                <div>
                  <p className="font-medium text-foreground">Próxima revisão</p>
                  <p
                    className={
                      new Date(classification.reviewDueAt) < new Date()
                        ? "text-destructive font-semibold"
                        : ""
                    }
                  >
                    {formatDate(classification.reviewDueAt)}
                  </p>
                </div>
              )}
              {classification.riskJustification && (
                <div className="col-span-2">
                  <p className="font-medium text-foreground">Justificativa</p>
                  <p>{classification.riskJustification}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Classification form */}
        <div className="rounded-lg border divide-y">
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Nível de risco</Label>
            <Select
              value={riskLevel || currentLevel || ""}
              onValueChange={(v) => setRiskLevel(v as RiskLevel)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Alto risco</SelectItem>
                <SelectItem value="limited">Risco limitado</SelectItem>
                <SelectItem value="minimal">Risco mínimo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <Label className="text-sm">Justificativa</Label>
            <Textarea
              rows={2}
              placeholder="Descreva por que o agente foi classificado neste nível…"
              value={riskJustification}
              onChange={(e) => setRiskJustification(e.target.value)}
              className="text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Próxima revisão</Label>
            <Input
              type="date"
              className="h-8 w-40"
              value={reviewDueAt}
              onChange={(e) => setReviewDueAt(e.target.value)}
            />
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => classifyMutation.mutate()}
          disabled={classifyMutation.isPending}
        >
          <Save className="mr-1 size-4" />
          {classification ? "Atualizar classificação" : "Classificar agente"}
        </Button>
      </section>

      {/* ── Checklist ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Checklist de Conformidade</h3>
          {checkSummary && checkSummary.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    checkSummary.rate >= 0.8
                      ? "bg-green-500"
                      : checkSummary.rate >= 0.5
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${Math.round(checkSummary.rate * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {checkSummary.compliant}/{checkSummary.total} ({Math.round(checkSummary.rate * 100)}%)
              </span>
            </div>
          )}
        </div>

        {checklistLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !checklist || checklist.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            <ShieldX className="mx-auto mb-2 size-8 opacity-40" />
            <p>Nenhum item de checklist. Classifique o agente para gerar o checklist.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden space-y-0 divide-y">
            {(Object.keys(CATEGORY_LABELS) as ChecklistCategory[])
              .filter((cat) => byCategory[cat]?.length)
              .map((cat) => {
                const items: ComplianceChecklistItem[] = byCategory[cat] ?? [];
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <CategoryProgress items={items} />
                    </div>
                    <div className="divide-y">
                      {items.map((item) => (
                        <ChecklistItemRow key={item.id} item={item} agentId={agentId} />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ── Reports ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Relatórios</h3>
        </div>

        {/* Generate report form */}
        <div className="rounded-lg border divide-y">
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Tipo de relatório</Label>
            <Select
              value={reportType}
              onValueChange={(v) => setReportType(v as ReportType)}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="audit">Auditoria</SelectItem>
                <SelectItem value="dpia">DPIA</SelectItem>
                <SelectItem value="human_oversight">Supervisão Humana</SelectItem>
                <SelectItem value="decision_explanation">Explicação de Decisão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Período (de)</Label>
            <Input
              type="date"
              className="h-8 w-40"
              value={reportPeriodFrom}
              onChange={(e) => setReportPeriodFrom(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Período (até)</Label>
            <Input
              type="date"
              className="h-8 w-40"
              value={reportPeriodTo}
              onChange={(e) => setReportPeriodTo(e.target.value)}
            />
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => reportMutation.mutate()}
          disabled={reportMutation.isPending}
        >
          <Plus className="mr-1 size-4" />
          Gerar relatório
        </Button>

        {/* Reports list */}
        {reportsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !reports || reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório gerado.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Título</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Gerado em</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-xs">
                        {REPORT_TYPE_LABELS[r.reportType]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{r.title}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(r.generatedAt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.generatedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Explainability ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Explicabilidade de Decisão</h3>
        <div className="rounded-lg border divide-y">
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Tipo de trace</Label>
            <Select value={traceType} onValueChange={setTraceType}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heartbeat">Heartbeat</SelectItem>
                <SelectItem value="conversation">Conversa</SelectItem>
                <SelectItem value="cron">Cron</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">ID do trace</Label>
            <Input
              className="h-8 w-52"
              placeholder="ex: 2026-03-08T14:00:00.000Z"
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
            />
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => explainMutation.mutate()}
          disabled={!traceId || explainMutation.isPending}
        >
          <Search className="mr-1 size-4" />
          Explicar decisão
        </Button>

        {explanation && (
          <div className="rounded-lg border divide-y text-sm">
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Entrada
              </p>
              <p>{explanation.input || "—"}</p>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Decisão
              </p>
              <p>{explanation.decision || "—"}</p>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Raciocínio
              </p>
              <p className="text-muted-foreground">{explanation.reasoning || "—"}</p>
            </div>
            {explanation.toolsUsed.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ferramentas utilizadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {explanation.toolsUsed.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {explanation.humanApproval && (
              <div className="px-4 py-3 flex items-center gap-2">
                {explanation.humanApproval.approved ? (
                  <ShieldCheck className="size-4 text-green-500" />
                ) : (
                  <ShieldAlert className="size-4 text-destructive" />
                )}
                <span className="text-xs">
                  Supervisão humana:{" "}
                  <strong>
                    {explanation.humanApproval.approved ? "Aprovado" : "Pendente/Rejeitado"}
                  </strong>{" "}
                  por {explanation.humanApproval.approvedBy}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Link to LGPD Dashboard ── */}
      <section>
        <div className="rounded-lg border p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">LGPD Dashboard</p>
            <p className="text-xs text-muted-foreground">
              Items de documentação de dados são compartilhados entre EU AI Act e LGPD.
            </p>
          </div>
          <Link
            to="/compliance"
            search={{ tab: "lgpd" } as Record<string, unknown>}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="size-3.5" />
            Ver painel LGPD
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
