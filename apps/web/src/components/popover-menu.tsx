import { useEffect, useRef, useState, type ReactNode } from "react"

export function PopoverMenu({
  trigger,
  children,
  align = "right",
  width = "min-w-48",
}: {
  trigger: (props: { open: boolean; onClick: (e: React.MouseEvent) => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: "left" | "right"
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {trigger({
        open,
        onClick: (e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen((v) => !v)
        },
      })}
      {open && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } top-full mt-1 z-30 bg-popover border rounded-md shadow-md py-1 ${width} text-sm max-h-80 overflow-auto`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
