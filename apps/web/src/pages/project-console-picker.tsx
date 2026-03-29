import { useEffect, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { Loader2, MessageSquareOff } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { WaveConsole } from "./wave-console"

interface Wave {
  wave_number: number
  status: "pending" | "running" | "completed" | "failed" | "interrupted"
}

export function ProjectConsolePickerPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/console" })

  const [loading, setLoading] = useState(true)
  const [runningWave, setRunningWave] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setRunningWave(null)
    apiFetch(`/api/v1/projects/${slug}/waves`)
      .then((r) => (r.ok ? (r.json() as Promise<Wave[]>) : Promise.resolve([])))
      .then((waves) => {
        const running = waves.find((w) => w.status === "running")
        setRunningWave(running ? running.wave_number : null)
      })
      .catch(() => setRunningWave(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (runningWave !== null) {
    return <WaveConsole slug={slug} waveNumber={String(runningWave)} />
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <MessageSquareOff className="w-12 h-12 text-muted-foreground/40" />
      <div>
        <h2 className="text-lg font-medium">Nenhuma wave em andamento</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          O console permite interagir com a engine enquanto uma wave está rodando.
          Inicie uma run para usar o console.
        </p>
      </div>
    </div>
  )
}
