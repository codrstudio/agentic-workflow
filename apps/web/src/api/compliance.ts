import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

// ---------- types ----------

export type RiskLevel = "high" | "limited" | "minimal";
export type ChecklistStatus = "pending" | "compliant" | "non_compliant" | "not_applicable";
export type ChecklistCategory =
  | "transparency"
  | "oversight"
  | "documentation"
  | "data_governance"
  | "risk_management";
export type ReportType = "audit" | "dpia" | "human_oversight" | "decision_explanation";

export interface ComplianceClassification {
  agentId: string;
  riskLevel: RiskLevel;
  riskJustification: string | null;
  classifiedBy: string;
  classifiedAt: string;
  reviewedAt: string | null;
  reviewDueAt: string | null;
}

export interface ComplianceChecklistItem {
  id: string;
  agentId: string;
  itemKey: string;
  itemLabel: string;
  category: ChecklistCategory;
  status: ChecklistStatus;
  evidence: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface ComplianceReport {
  id: string;
  agentId: string | null;
  reportType: ReportType;
  title: string;
  content: string;
  generatedBy: string;
  generatedAt: string;
  periodFrom: string | null;
  periodTo: string | null;
}

export interface DecisionExplanation {
  traceId: string;
  agentId: string;
  timestamp: string;
  input: string;
  decision: string;
  reasoning: string;
  toolsUsed: string[];
  instructionVersion: string;
  memoryContext: string[];
  humanApproval?: {
    required: boolean;
    approved: boolean;
    approvedBy: string;
    approvedAt: string;
  } | null;
}

export interface ComplianceSummary {
  agentId: string;
  classification: ComplianceClassification | null;
  checklistSummary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
    rate: number;
  };
  reportsCount: number;
  latestReport: ComplianceReport | null;
}

export interface ComplianceOverviewAgent {
  agentId: string;
  riskLevel: RiskLevel | null;
  complianceRate: number;
  checklistTotal: number;
  checklistCompliant: number;
  reviewDueAt: string | null;
  hasOverdueReview: boolean;
}

export interface ComplianceOverview {
  totalAgents: number;
  byRiskLevel: Record<RiskLevel, number>;
  complianceRate: number;
  nonCompliantItems: Array<{
    agentId: string;
    itemKey: string;
    category: string;
  }>;
  pendingReviews: Array<{
    agentId: string;
    reviewDueAt: string;
  }>;
  agents: ComplianceOverviewAgent[];
}

export interface UpdateClassificationBody {
  riskLevel: RiskLevel;
  riskJustification?: string;
  reviewDueAt?: string;
}

export interface UpdateChecklistItemBody {
  status: ChecklistStatus;
  evidence?: string;
}

export interface GenerateReportBody {
  reportType: ReportType;
  periodFrom?: string;
  periodTo?: string;
  traceType?: string;
  traceId?: string;
}

export interface ExplainBody {
  traceType: string;
  traceId: string;
}

// ---------- queryOptions ----------

export function complianceSummaryQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["compliance", agentId],
    queryFn: () => request<ComplianceSummary>(`/agents/${agentId}/compliance`),
  });
}

export function complianceClassificationQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["compliance", agentId, "classification"],
    queryFn: () =>
      request<ComplianceClassification>(`/agents/${agentId}/compliance/classification`),
  });
}

export function complianceChecklistQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["compliance", agentId, "checklist"],
    queryFn: () =>
      request<ComplianceChecklistItem[]>(`/agents/${agentId}/compliance/checklist`),
  });
}

export function complianceReportsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["compliance", agentId, "reports"],
    queryFn: () =>
      request<ComplianceReport[]>(`/agents/${agentId}/compliance/reports`),
  });
}

export function complianceOverviewQueryOptions() {
  return queryOptions({
    queryKey: ["compliance", "overview"],
    queryFn: () => request<ComplianceOverview>("/compliance/overview"),
  });
}

// ---------- mutations ----------

export function updateClassification(agentId: string, body: UpdateClassificationBody) {
  return request<ComplianceClassification>(`/agents/${agentId}/compliance/classification`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function updateChecklistItem(
  agentId: string,
  itemKey: string,
  body: UpdateChecklistItemBody,
) {
  return request<ComplianceChecklistItem>(
    `/agents/${agentId}/compliance/checklist/${itemKey}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function generateReport(agentId: string, body: GenerateReportBody) {
  return request<{ reportId: string; report: ComplianceReport }>(
    `/agents/${agentId}/compliance/reports`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function explainDecision(agentId: string, body: ExplainBody) {
  return request<DecisionExplanation>(`/agents/${agentId}/compliance/explain`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
