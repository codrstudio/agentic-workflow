import { useState } from "react"
import {
  Funnel,
  X,
  CaretDown,
  Check,
} from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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
import { cn } from "@workspace/ui/lib/utils"
import { useUsers } from "@/lib/hooks/use-users"
import { useLabelConfigs } from "@/lib/hooks/use-label-configs"

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
]

export interface ThreadFilterValues {
  assignee: string | undefined
  priority: string | undefined
  labels: string | undefined
  createdFrom: string | undefined
  createdTo: string | undefined
}

interface Props extends ThreadFilterValues {
  onChange: (updates: Partial<ThreadFilterValues>) => void
  onClear: () => void
}

function countActiveFilters(f: ThreadFilterValues): number {
  let count = 0
  if (f.assignee) count++
  if (f.priority) count++
  if (f.labels) count++
  if (f.createdFrom) count++
  if (f.createdTo) count++
  return count
}

function FilterFields({
  assignee,
  priority,
  labels,
  createdFrom,
  createdTo,
  onChange,
  onClear,
}: Props) {
  const { data: usersData } = useUsers()
  const { data: labelsData } = useLabelConfigs()

  const users = usersData?.data ?? []
  const labelList = labelsData ?? []

  const activeLabels = labels ? labels.split(",").filter(Boolean) : []
  const activeCount = countActiveFilters({ assignee, priority, labels, createdFrom, createdTo })

  const selectedAssigneeName =
    users.find((u) => u.id === assignee)?.name ?? "Todos"
  const selectedPriorityLabel =
    PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? "Todas"

  function toggleLabel(slug: string) {
    const current = new Set(activeLabels)
    if (current.has(slug)) {
      current.delete(slug)
    } else {
      current.add(slug)
    }
    onChange({ labels: current.size > 0 ? [...current].join(",") : undefined })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Assignee */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Atendente
          </label>
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                      size="sm"
                    >
                      <span className="truncate">{selectedAssigneeName}</span>
                      <CaretDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Filtrar por atendente responsável</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent className="w-56">
              <DropdownMenuRadioGroup
                value={assignee ?? ""}
                onValueChange={(val) =>
                  onChange({ assignee: val || undefined })
                }
              >
                <DropdownMenuRadioItem value="">Todos</DropdownMenuRadioItem>
                {users.map((u) => (
                  <DropdownMenuRadioItem key={u.id} value={u.id}>
                    {u.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Prioridade
          </label>
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                      size="sm"
                    >
                      <span>{selectedPriorityLabel}</span>
                      <CaretDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Filtrar por prioridade</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup
                value={priority ?? ""}
                onValueChange={(val) =>
                  onChange({ priority: val || undefined })
                }
              >
                <DropdownMenuRadioItem value="">Todas</DropdownMenuRadioItem>
                {PRIORITY_OPTIONS.map((p) => (
                  <DropdownMenuRadioItem key={p.value} value={p.value}>
                    {p.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Labels
          </label>
          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                      size="sm"
                    >
                      <span className="truncate">
                        {activeLabels.length > 0
                          ? `${activeLabels.length} selecionada${activeLabels.length > 1 ? "s" : ""}`
                          : "Todas"}
                      </span>
                      <CaretDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Filtrar por label</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-56 p-1">
              {labelList.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Nenhuma label disponível
                </p>
              ) : (
                labelList.map((l) => {
                  const key = l.key
                  const checked = activeLabels.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleLabel(key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                        checked && "font-medium",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded border border-border",
                          checked && "bg-primary border-primary text-primary-foreground",
                        )}
                      >
                        {checked && <Check className="size-2.5" />}
                      </span>
                      {l.displayName ?? key}
                    </button>
                  )
                })
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Period */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Período
          </label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={createdFrom ?? ""}
              onChange={(e) =>
                onChange({ createdFrom: e.target.value || undefined })
              }
              className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Data de início"
            />
            <span className="text-xs text-muted-foreground shrink-0">—</span>
            <input
              type="date"
              value={createdTo ?? ""}
              onChange={(e) =>
                onChange({ createdTo: e.target.value || undefined })
              }
              className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Data de fim"
            />
          </div>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}

export function ThreadFilters(props: Props) {
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const activeCount = countActiveFilters(props)

  const triggerButton = (onClick?: () => void) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className="gap-1.5 shrink-0"
          >
            <Funnel className="size-3.5" />
            Filtros
            {activeCount > 0 && (
              <Badge className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]">
                {activeCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Filtros avançados de chamados</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <>
      {/* Desktop: collapsible panel */}
      <div className="hidden md:block">
        <Collapsible open={desktopOpen} onOpenChange={setDesktopOpen}>
          <CollapsibleTrigger asChild>
            {triggerButton()}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="rounded-lg border border-border p-4">
              <FilterFields {...props} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Mobile: bottom sheet */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            {triggerButton(() => setSheetOpen(true))}
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <FilterFields {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
