import type { ReactNode } from "react"
import { cn } from "@ui/lib/utils"

interface PageLayoutProps {
  children: ReactNode
  className?: string
}

export function PageDefault({ children, className }: PageLayoutProps) {
  return (
    <div className={cn("flex flex-1 flex-col gap-4 p-4", className)}>
      {children}
    </div>
  )
}

export function PageFull({ children, className }: PageLayoutProps) {
  return (
    <div className={cn("flex flex-1 flex-col", className)}>
      {children}
    </div>
  )
}
