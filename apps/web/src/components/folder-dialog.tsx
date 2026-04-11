import { useEffect, useState } from "react"
import { Modal } from "./modal"
import { FOLDER_ICONS } from "@/lib/folder-icons"

interface FolderInput {
  id?: string
  name: string
  icon?: string
}

export function FolderDialog({
  open,
  onClose,
  onSubmit,
  folder,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; icon: string }) => void | Promise<void>
  folder?: FolderInput | null
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("folder")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? "")
      setIcon(folder?.icon ?? "folder")
      setSubmitting(false)
    }
  }, [open, folder])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({ name: trimmed, icon })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const isEdit = !!folder?.id
  const canSubmit = name.trim().length > 0 && !submitting

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar pasta" : "Nova pasta"}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isEdit ? "Salvar" : "Criar"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
            Nome
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ex: Clientes"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
            Ícone
          </label>
          <div className="grid grid-cols-10 gap-1.5">
            {FOLDER_ICONS.map(({ name: iname, Icon }) => {
              const selected = icon === iname
              return (
                <button
                  type="button"
                  key={iname}
                  onClick={() => setIcon(iname)}
                  className={`flex items-center justify-center aspect-square rounded-md border transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent hover:bg-muted text-muted-foreground"
                  }`}
                  aria-label={iname}
                  aria-pressed={selected}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        </div>
        {/* allow Enter-to-submit from the name input */}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
