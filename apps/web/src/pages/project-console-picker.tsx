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
  const [targetWave, setTargetWave] = useState<number | null>(null)
  const [waveRunning, setWaveRunning] = useState(false)

  useEffect(() => {
    setLoading(true)
    setTargetWave(null)
    setWaveRunning(false)
    apiFetch(`/api/v1/projects/${slug}/waves`)
      .then((r) => (r.ok ? (r.json() as Promise<Wave[]>) : Promise.resolve([])))
      .then((waves) => {
        if (waves.length === 0) {
          setTargetWave(null)
          return
        }
        // Prefer running wave, otherwise pick the latest (highest wave_number)
        const running = waves.find((w) => w.status === "running")
        if (running) {
          setTargetWave(running.wave_number)
          setWaveRunning(true)
        } else {
          const latest = waves.reduce((a, b) => (b.wave_number > a.wave_number ? b : a))
          setTargetWave(latest.wave_number)
        }
      })
      .catch(() => setTargetWave(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (targetWave !== null) {
    return <WaveConsole slug={slug} waveNumber={String(targetWave)} isRunning={waveRunning} />
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <MessageSquareOff className="w-12 h-12 text-muted-foreground/40" />
      <div>
        <h2 className="text-lg font-medium">Nenhuma wave encontrada</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Inicie uma run para criar a primeira wave e usar o console.
        </p>
      </div>
    </div>
  )
}
