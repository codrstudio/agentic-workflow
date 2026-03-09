import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface ApprovalRequest {
  id: number;
  agent_id: string;
  session_id?: string;
  tool_name: string;
  action_label: string;
  payload: string;
  status: "pending" | "approved" | "rejected" | "expired";
  decided_by?: string;
  decided_at?: string;
  expires_at: string;
  created_at: string;
}

export const pendingApprovalsQueryOptions = () =>
  queryOptions({
    queryKey: ["approvals", "pending"],
    queryFn: () => request<ApprovalRequest[]>("/approval-requests?status=pending"),
  });

export const approvalHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["approvals", "history"],
    queryFn: () =>
      request<ApprovalRequest[]>("/approval-requests?status=approved,rejected,expired"),
  });
