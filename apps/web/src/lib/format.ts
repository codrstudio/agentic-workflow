/** Format milliseconds as human-readable duration (e.g. "45s", "3m 12s"). */
export function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/** Format large token counts compactly (e.g. 1500 → "1.5k", 2000000 → "2.0M"). */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
