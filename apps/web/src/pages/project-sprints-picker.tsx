import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { CheckCircle2, XCircle, Loader2, Circle, AlertTriangle, ListChecks } from "lucide-react"
import { apiFetch } from "@/lib/api"

type WaveStatus = "pending" | "running" | "completed" | "failed" | "interrupted"

interface Wave {
  wave_number: number
  status: WaveStatus
  steps_total: number
  steps_completed: number
  steps_failed: number
  has_sprint: boolean
  sprint_name: string | null
}

function WaveStatusIcon({ status }: { status: WaveStatus }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
  if (status === "interrupted") return <AlertTriangle className="w-4 h-4 text-amber-500" />
  return <Circle className="w-4 h-4 text-muted-foreground/40" />
}

export function ProjectSprintsPickerPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/sprints" })

  const [waves, setWaves] = useState<Wave[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch(`/api/v1/projects/${slug}/waves`)
      .then((r) => (r.ok ? (r.json() as Promise<Wave[]>) : Promise.resolve([])))
      .then(setWaves)
      .catch(() => setWaves([]))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-4">
        <div className="h-5 bg-muted rounded w-1/4 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col p-6 gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Sprints</h1>
        <p className="text-sm text-muted-foreground mt-1">Selecione uma wave para ver as feature lists.</p>
      </div>

      {waves.filter((w) => w.has_sprint).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum sprint encontrado.</p>
      ) : (
        <div className="grid gap-3">
          {waves.filter((w) => w.has_sprint).map((wave) => (
            <Link
              key={wave.wave_number}
              to="/projects/$slug/sprints/$waveNumber"
              params={{ slug, waveNumber: String(wave.wave_number) }}
              className="bg-card border rounded-lg p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <WaveStatusIcon status={wave.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium capitalize">{wave.sprint_name?.replace('-', ' ')}</span>
                  <span className="text-xs text-muted-foreground">
                    Wave {wave.wave_number} · {wave.steps_completed}/{wave.steps_total} steps
                  </span>
                </div>
                {wave.steps_failed > 0 && (
                  <span className="text-xs text-red-500">{wave.steps_failed} erro(s)</span>
                )}
              </div>
              <ListChecks className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
