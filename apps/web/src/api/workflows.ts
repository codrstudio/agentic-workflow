import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export type ConditionType = "keyword" | "intent" | "sentiment" | "schedule" | "channel" | "fallback";

export interface EdgeCondition {
  type: ConditionType;
  value?: string;
  days?: string[];
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  label: string;
  position: { x: number; y: number };
  isEntry?: boolean;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition: EdgeCondition;
  label: string;
}

export interface Workflow {
  id: string;
  label: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  applied?: boolean;
}

export interface WorkflowListItem {
  id: string;
  label: string;
  nodeCount: number;
  updatedAt: string;
  applied: boolean;
}

export interface ApplyResult {
  applied: boolean;
  agentsUpdated: string[];
  warnings: string[];
}

export function workflowsQueryOptions() {
  return queryOptions({
    queryKey: ["workflows"],
    queryFn: () => request<WorkflowListItem[]>("/workflows"),
  });
}

export function workflowQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["workflows", id],
    queryFn: () => request<Workflow>(`/workflows/${id}`),
  });
}

export async function createWorkflow(payload: { label: string }): Promise<Workflow> {
  return request<Workflow>("/workflows", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorkflow(
  id: string,
  payload: Partial<Pick<Workflow, "label" | "nodes" | "edges">>,
): Promise<Workflow> {
  return request<Workflow>(`/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await request(`/workflows/${id}`, { method: "DELETE" });
}

export async function applyWorkflow(id: string): Promise<ApplyResult> {
  return request<ApplyResult>(`/workflows/${id}/apply`, { method: "POST" });
}

export interface SimulateRequest {
  input: string;
  startNodeId: string;
  channelType?: string;
}

export interface SimulateResult {
  path: string[];
  matchedEdge: string | null;
  matchedCondition: EdgeCondition | null;
  selectedAgent: string | null;
  reasoning: string;
}

export async function simulateWorkflow(id: string, payload: SimulateRequest): Promise<SimulateResult> {
  return request<SimulateResult>(`/workflows/${id}/simulate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function agentWorkflowsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["workflows", "agent", agentId],
    queryFn: async () => {
      const workflows = await request<Workflow[]>("/workflows");
      return workflows.filter((wf) => wf.nodes.some((n) => n.agentId === agentId));
    },
  });
}
