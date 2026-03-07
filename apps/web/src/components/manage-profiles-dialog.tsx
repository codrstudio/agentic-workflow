import { useState, useEffect } from "react";
import { Settings, Plus, Pencil, Trash2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-badge";
import type { Source, SourceCategory } from "@/hooks/use-sources";
import type { ContextProfile } from "@/hooks/use-context-profiles";
import {
  useCreateProfile,
  useUpdateProfile,
  useDeleteProfile,
} from "@/hooks/use-context-profiles";

const categoryOrder: SourceCategory[] = [
  "business",
  "backend",
  "frontend",
  "config",
  "reference",
  "general",
];

const categoryLabels: Record<SourceCategory, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  business: "Business",
  reference: "Reference",
  config: "Config",
};

function groupSourcesByCategory(sources: Source[]) {
  const groups: Partial<Record<SourceCategory, Source[]>> = {};
  for (const source of sources) {
    const cat = source.category ?? "general";
    if (!groups[cat]) groups[cat] = [];
    groups[cat]!.push(source);
  }
  return categoryOrder
    .filter((cat) => groups[cat] && groups[cat]!.length > 0)
    .map((cat) => ({ category: cat, sources: groups[cat]! }));
}

type ViewMode = "list" | "form";

interface ManageProfilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  profiles: ContextProfile[];
  sources: Source[];
}

export function ManageProfilesDialog({
  open,
  onOpenChange,
  projectSlug,
  profiles,
  sources,
}: ManageProfilesDialogProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [editingProfile, setEditingProfile] = useState<ContextProfile | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSourceIds, setFormSourceIds] = useState<string[]>([]);
  const [formIsDefault, setFormIsDefault] = useState(false);

  const createProfile = useCreateProfile(projectSlug);
  const updateProfile = useUpdateProfile(projectSlug);
  const deleteProfile = useDeleteProfile(projectSlug);

  useEffect(() => {
    if (!open) {
      setView("list");
      setEditingProfile(null);
    }
  }, [open]);

  const grouped = groupSourcesByCategory(sources);

  const openCreateForm = () => {
    setEditingProfile(null);
    setFormName("");
    setFormDescription("");
    setFormSourceIds([]);
    setFormIsDefault(false);
    setView("form");
  };

  const openEditForm = (profile: ContextProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormDescription(profile.description ?? "");
    setFormSourceIds([...profile.source_ids]);
    setFormIsDefault(profile.is_default);
    setView("form");
  };

  const toggleSourceInForm = (id: string) => {
    setFormSourceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    if (editingProfile) {
      await updateProfile.mutateAsync({
        id: editingProfile.id,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        source_ids: formSourceIds,
        is_default: formIsDefault,
      });
    } else {
      await createProfile.mutateAsync({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        source_ids: formSourceIds,
        is_default: formIsDefault,
      });
    }
    setView("list");
    setEditingProfile(null);
  };

  const handleDelete = async (id: string) => {
    await deleteProfile.mutateAsync(id);
  };

  const isSaving = createProfile.isPending || updateProfile.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {view === "list" ? "Gerenciar Perfis" : editingProfile ? "Editar Perfil" : "Novo Perfil"}
          </DialogTitle>
          <DialogDescription>
            {view === "list"
              ? "Crie e edite perfis de contexto para pre-selecionar sources."
              : "Configure o perfil com nome e selecione os sources por categoria."}
          </DialogDescription>
        </DialogHeader>

        {view === "list" ? (
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
            {profiles.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum perfil criado ainda.
              </p>
            )}
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{profile.name}</span>
                    {profile.is_default && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        <Star className="h-3 w-3 mr-0.5" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.source_ids.length} source{profile.source_ids.length !== 1 ? "s" : ""}
                    {profile.description ? ` — ${profile.description}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => openEditForm(profile)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(profile.id)}
                  disabled={deleteProfile.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                placeholder="Ex: Full Stack, Frontend Only..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-desc">Descricao (opcional)</Label>
              <Input
                id="profile-desc"
                placeholder="Descricao curta do perfil"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <Label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formIsDefault}
                onCheckedChange={(checked) => setFormIsDefault(checked === true)}
              />
              <span className="text-sm">Perfil default (pre-selecionado em novas sessoes)</span>
            </Label>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Sources</Label>
              {grouped.map(({ category, sources: catSources }) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center gap-2 py-1">
                    <CategoryBadge category={category} />
                    <span className="text-xs text-muted-foreground">
                      {categoryLabels[category]}
                    </span>
                  </div>
                  {catSources.map((source) => (
                    <Label
                      key={source.id}
                      className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={formSourceIds.includes(source.id)}
                        onCheckedChange={() => toggleSourceInForm(source.id)}
                      />
                      <span className="text-sm truncate">{source.name}</span>
                    </Label>
                  ))}
                </div>
              ))}
              {sources.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum source disponivel.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {view === "list" ? (
            <Button onClick={openCreateForm} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo Perfil
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setView("list"); setEditingProfile(null); }}
              >
                Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!formName.trim() || isSaving}
              >
                {isSaving ? "Salvando..." : editingProfile ? "Salvar" : "Criar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
