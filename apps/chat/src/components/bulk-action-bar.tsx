import { useState } from "react"
import { toast } from "sonner"
import {
  X,
  XCircle,
  UserPlus,
  Tag,
} from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import { useBulkClose, useBulkAssign, useBulkLabel } from "@/lib/hooks/use-bulk-actions"
import { useUsers } from "@/lib/hooks/use-users"
import { useLabelConfigs } from "@/lib/hooks/use-label-configs"

interface BulkActionBarProps {
  selectedIds: string[]
  onClear: () => void
}

export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const count = selectedIds.length
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const { data: usersData } = useUsers()
  const { data: labelConfigs } = useLabelConfigs()

  const bulkClose = useBulkClose()
  const bulkAssign = useBulkAssign()
  const bulkLabel = useBulkLabel()

  const users = usersData?.data ?? []
  const labels = (labelConfigs ?? []).filter(
    (l) => l.key !== "open" && l.key !== "closed"
  )

  async function handleClose() {
    try {
      const result = await bulkClose.mutateAsync(selectedIds)
      toast.success(
        result.success === 1
          ? "1 chamado fechado com sucesso"
          : `${result.success} chamados fechados com sucesso`
      )
      if (result.failed > 0) {
        toast.error(`${result.failed} chamado(s) não puderam ser fechados`)
      }
    } catch {
      toast.error("Erro ao fechar chamados")
    }
    setCloseDialogOpen(false)
    onClear()
  }

  async function handleAssign(assignee_id: string, assignee_name: string) {
    try {
      const result = await bulkAssign.mutateAsync({ thread_ids: selectedIds, assignee_id })
      toast.success(
        result.success === 1
          ? `1 chamado atribuído a ${assignee_name}`
          : `${result.success} chamados atribuídos a ${assignee_name}`
      )
      if (result.failed > 0) {
        toast.error(`${result.failed} chamado(s) não puderam ser atribuídos`)
      }
    } catch {
      toast.error("Erro ao atribuir chamados")
    }
    onClear()
  }

  async function handleLabel(label_id: string, label_name: string) {
    try {
      const result = await bulkLabel.mutateAsync({ thread_ids: selectedIds, label_id })
      toast.success(
        result.success === 1
          ? `Label "${label_name}" adicionada a 1 chamado`
          : `Label "${label_name}" adicionada a ${result.success} chamados`
      )
      if (result.failed > 0) {
        toast.error(`${result.failed} chamado(s) não puderam receber a label`)
      }
    } catch {
      toast.error("Erro ao adicionar label")
    }
    onClear()
  }

  return (
    <>
      {/* Floating action bar */}
      <div
        className={[
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-200",
          count > 0
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 bg-popover border border-border rounded-xl shadow-xl px-4 py-2.5 min-w-max">
          <span className="text-sm font-medium text-foreground mr-2">
            {count === 1 ? "1 chamado selecionado" : `${count} chamados selecionados`}
          </span>

          <TooltipProvider>
            {/* Close button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCloseDialogOpen(true)}
                  disabled={bulkClose.isPending}
                >
                  <X className="size-3.5" />
                  Fechar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fechar chamados selecionados</TooltipContent>
            </Tooltip>

            {/* Assign button */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkAssign.isPending}
                    >
                      <UserPlus className="size-3.5" />
                      Atribuir
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Atribuir responsável aos chamados selecionados</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" side="top" className="min-w-44 max-h-60 overflow-y-auto">
                {users.length === 0 ? (
                  <DropdownMenuItem disabled>Nenhum usuário disponível</DropdownMenuItem>
                ) : (
                  users.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onSelect={() => handleAssign(user.id, user.name)}
                    >
                      {user.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Label button */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkLabel.isPending}
                    >
                      <Tag className="size-3.5" />
                      Label
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Adicionar label aos chamados selecionados</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" side="top" className="min-w-44 max-h-60 overflow-y-auto">
                {labels.length === 0 ? (
                  <DropdownMenuItem disabled>Nenhuma label disponível</DropdownMenuItem>
                ) : (
                  labels.map((label) => (
                    <DropdownMenuItem
                      key={label.key}
                      onSelect={() => handleLabel(label.key, label.displayName ?? label.key)}
                    >
                      {label.displayName ?? label.key}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cancel button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                >
                  <XCircle className="size-3.5" />
                  Cancelar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpar seleção</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Close confirmation dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar chamados</DialogTitle>
            <DialogDescription>
              {count === 1
                ? "Tem certeza que deseja fechar 1 chamado selecionado?"
                : `Tem certeza que deseja fechar ${count} chamados selecionados?`}
              {" "}Esta ação pode ser revertida reabrindo os chamados individualmente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={bulkClose.isPending}
            >
              {bulkClose.isPending ? "Fechando..." : "Fechar chamados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
