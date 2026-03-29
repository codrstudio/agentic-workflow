import { ArrowsDownUp } from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

export type SortKey = "recent" | "oldest" | "priority" | "sla"

const SORT_OPTIONS: { value: SortKey; label: string; sort: string; order: string }[] = [
  { value: "recent", label: "Mais recente", sort: "last_activity", order: "desc" },
  { value: "oldest", label: "Mais antigo", sort: "last_activity", order: "asc" },
  { value: "priority", label: "Prioridade", sort: "priority", order: "asc" },
  { value: "sla", label: "SLA (urgente primeiro)", sort: "sla", order: "asc" },
]

interface Props {
  sort: string | undefined
  order: string | undefined
  onChange: (sort: string, order: string) => void
}

function getSortKey(sort: string | undefined, order: string | undefined): SortKey {
  if (sort === "sla") return "sla"
  if (sort === "priority") return "priority"
  if (sort === "last_activity" && order === "asc") return "oldest"
  return "recent"
}

export function ThreadSort({ sort, order, onChange }: Props) {
  const currentKey = getSortKey(sort, order)
  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentKey)?.label ?? "Mais recente"

  function handleChange(key: string) {
    const opt = SORT_OPTIONS.find((o) => o.value === key)
    if (opt) onChange(opt.sort, opt.order)
  }

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <ArrowsDownUp className="size-3.5" />
                <span className="hidden sm:inline">{currentLabel}</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Ordenar chamados</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={currentKey} onValueChange={handleChange}>
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
