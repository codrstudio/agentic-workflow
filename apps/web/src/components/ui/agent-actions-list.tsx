import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { StatusBadge } from "@workspace/ui/components/status-badge"

export interface AgentAction {
  id: string
  project_slug: string
  action_type: string
  status: "running" | "completed" | "failed"
  agent_profile?: string
  task_name?: string
  feature_id?: string
  spawn_dir?: string
  started_at: string
  completed_at?: string
  duration_ms?: number
  exit_code?: number
  output_preview?: string
  requires_approval: boolean
}

function formatDuration(action: AgentAction): string {
  if (action.duration_ms !== undefined) {
    const ms = action.duration_ms
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }
  if (action.status === "running") {
    const start = new Date(action.started_at).getTime()
    const seconds = Math.floor((Date.now() - start) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }
  return "—"
}

function ActionRow({ action }: { action: AgentAction }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-2 px-3">
          <div className="flex items-center gap-1.5">
            {action.status === "running" && (
              <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
            )}
            <StatusBadge status={action.status} />
          </div>
        </td>
        <td className="py-2 px-3 text-xs font-mono text-muted-foreground max-w-[140px] truncate">
          {action.task_name ?? action.action_type}
        </td>
        <td className="py-2 px-3 text-xs text-muted-foreground max-w-[100px] truncate">
          {action.agent_profile ?? "—"}
        </td>
        <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
          {action.feature_id ?? "—"}
        </td>
        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
          {formatDuration(action)}
        </td>
        <td className="py-2 px-3">
          {action.output_preview ? (
            <span className="text-xs text-muted-foreground">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 inline" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 inline" />
              )}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          )}
        </td>
      </tr>
      {expanded && action.output_preview && (
        <tr className="border-b last:border-0 bg-muted/20">
          <td colSpan={6} className="px-3 py-2">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {action.output_preview}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

interface AgentActionsListProps {
  actions: AgentAction[]
}

export function AgentActionsList({ actions }: AgentActionsListProps) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhuma agent action registrada.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Task</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Agent</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Feature</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Duração</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Preview</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
