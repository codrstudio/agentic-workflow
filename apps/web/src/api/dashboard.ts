import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface DashboardData {
  agents: {
    total: number;
    enabled: number;
    heartbeatEnabled: number;
  };
  heartbeats: {
    today: {
      total: number;
      ok: number;
      error: number;
      skipped: number;
    };
    costToday: number;
  };
  conversations: {
    totalSessions: number;
    today: number;
  };
  cronJobs: {
    total: number;
    enabled: number;
    nextRuns: Array<{
      agentId: string;
      slug: string;
      schedule: string;
      nextRun: string;
    }>;
  };
  jobs: {
    running: number;
    completed: number;
    failed: number;
  };
  recentActivity: Array<{
    type: "heartbeat" | "cron" | "conversation";
    agentId: string;
    status: string;
    ts: string;
    preview?: string;
    slug?: string;
    sessionId?: string;
  }>;
  system: {
    uptime: number;
    version: string;
  };
}

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard"],
    queryFn: () => request<DashboardData>("/system/dashboard"),
  });
}
