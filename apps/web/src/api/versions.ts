import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface VersionedFile {
  file_name: string;
  total_versions: number;
  latest_version: number;
  last_modified: string;
}

export interface VersionMeta {
  id: number;
  version_num: number;
  size_bytes: number | null;
  change_note: string | null;
  eval_run_id: number | null;
  created_at: string;
  created_by: string | null;
}

export interface VersionContent extends VersionMeta {
  agentId: string;
  fileName: string;
  content: string;
}

export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  line: number;
  content: string;
}

export interface VersionDiff {
  agentId: string;
  fileName: string;
  versionNum: number;
  previousVersionNum: number | null;
  diff: DiffLine[];
}

export interface RollbackResult {
  ok: boolean;
  rolledBackTo: number;
  safetyVersionNum: number;
}

export const agentVersionedFilesQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["versions", agentId],
    queryFn: () => request<VersionedFile[]>(`/agents/${agentId}/versions`),
  });

export const fileVersionsQueryOptions = (agentId: string, filename: string) =>
  queryOptions({
    queryKey: ["versions", agentId, filename],
    queryFn: () => request<VersionMeta[]>(`/agents/${agentId}/versions/${encodeURIComponent(filename)}`),
  });

export const versionContentQueryOptions = (agentId: string, filename: string, versionNum: number) =>
  queryOptions({
    queryKey: ["versions", agentId, filename, versionNum],
    queryFn: () =>
      request<VersionContent>(
        `/agents/${agentId}/versions/${encodeURIComponent(filename)}/${versionNum}`
      ),
  });

export const versionDiffQueryOptions = (agentId: string, filename: string, versionNum: number) =>
  queryOptions({
    queryKey: ["versions", agentId, filename, versionNum, "diff"],
    queryFn: () =>
      request<VersionDiff>(
        `/agents/${agentId}/versions/${encodeURIComponent(filename)}/${versionNum}/diff`
      ),
  });

export function rollbackVersion(agentId: string, filename: string, versionNum: number) {
  return request<RollbackResult>(
    `/agents/${agentId}/versions/${encodeURIComponent(filename)}/${versionNum}/rollback`,
    { method: "POST" }
  );
}
