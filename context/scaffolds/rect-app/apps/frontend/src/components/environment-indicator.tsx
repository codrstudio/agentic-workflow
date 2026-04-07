declare const __APP_ENV__: string

const env = __APP_ENV__

const config: Record<string, { label: string; color: string }> = {
  development: { label: "DEVELOPMENT", color: "bg-orange-500 text-orange-950" },
  staging: { label: "STAGING", color: "bg-yellow-500 text-yellow-950" },
}

export function EnvironmentIndicator() {
  const entry = env ? config[env] : null
  if (!entry) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center">
      <div className={`${entry.color} pointer-events-auto rounded-b-md px-3 py-0.5 text-[10px] font-bold tracking-widest uppercase shadow-md`}>
        {entry.label}
      </div>
    </div>
  )
}
