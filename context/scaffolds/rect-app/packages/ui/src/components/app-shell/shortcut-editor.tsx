import { cn } from "@ui/lib/utils"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@ui/components/ui/drawer"
import { ArrowUp, ArrowDown, Plus, X } from "@phosphor-icons/react"
import type { MenuItem } from "@ui/components/app-menu/types"

interface ShortcutEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: MenuItem[]
  available: MenuItem[]
  isFull: boolean
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onReorder: (from: number, to: number) => void
}

export function ShortcutEditor({
  open,
  onOpenChange,
  shortcuts,
  available,
  isFull,
  onAdd,
  onRemove,
  onReorder,
}: ShortcutEditorProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="flex flex-row items-center justify-between">
          <DrawerTitle>Editar atalhos</DrawerTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm font-medium text-primary"
          >
            Pronto
          </button>
        </DrawerHeader>

        <div className="space-y-6 overflow-y-auto px-4 pb-6">
          {/* Current shortcuts */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Seus atalhos (máx. 5)
            </p>
            <div className="rounded-lg border">
              {shortcuts.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Nenhum atalho fixado
                </p>
              )}
              {shortcuts.map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      index > 0 && "border-t",
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={index === 0}
                        onClick={() => onReorder(index, index - 1)}
                        className="text-muted-foreground disabled:opacity-20"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        disabled={index === shortcuts.length - 1}
                        onClick={() => onReorder(index, index + 1)}
                        className="text-muted-foreground disabled:opacity-20"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                    <Icon className="size-5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">
                      {item.label}
                    </span>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Available items to add */}
          {available.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Adicionar
              </p>
              <div className="rounded-lg border">
                {available.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      disabled={isFull}
                      onClick={() => onAdd(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        "hover:bg-accent disabled:opacity-40",
                        index > 0 && "border-t",
                      )}
                    >
                      <Plus className="size-4 shrink-0 text-primary" />
                      <Icon className="size-5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
