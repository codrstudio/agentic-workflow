import { useState } from "react";
import { FileText, Code, Link, FileType, File, Settings, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ManageProfilesDialog } from "@/components/manage-profiles-dialog";
import type { Source } from "@/hooks/use-sources";
import type { ContextProfile } from "@/hooks/use-context-profiles";

const typeIcons: Record<Source["type"], React.ComponentType<{ className?: string }>> = {
  markdown: FileText,
  text: FileType,
  pdf: File,
  url: Link,
  code: Code,
};

interface SourceContextSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: Source[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  projectSlug: string;
  profiles: ContextProfile[];
  selectedProfileId: string | null;
  onProfileChange: (profileId: string | null) => void;
}

export function SourceContextSheet({
  open,
  onOpenChange,
  sources,
  selectedIds,
  onSelectionChange,
  projectSlug,
  profiles,
  selectedProfileId,
  onProfileChange,
}: SourceContextSheetProps) {
  const [manageOpen, setManageOpen] = useState(false);

  const toggleSource = (id: string) => {
    // When manually toggling, clear profile selection
    onProfileChange(null);
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleProfileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      // "Nenhum" selected — keep current manual selection
      onProfileChange(null);
      return;
    }
    const profile = profiles.find((p) => p.id === value);
    if (profile) {
      onProfileChange(profile.id);
      onSelectionChange([...profile.source_ids]);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Contexto de Sources</SheetTitle>
            <SheetDescription>
              Selecione os sources que o assistente deve usar como contexto.
            </SheetDescription>
          </SheetHeader>

          {/* Profile Selector */}
          <div className="px-4 pb-2 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Perfil de contexto</Label>
            <div className="relative">
              <select
                value={selectedProfileId ?? ""}
                onChange={handleProfileSelect}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm appearance-none cursor-pointer pr-8 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Nenhum (selecao manual)</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-7"
              onClick={() => setManageOpen(true)}
            >
              <Settings className="h-3 w-3 mr-1.5" />
              Gerenciar perfis
            </Button>
          </div>

          {/* Sources list */}
          <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
            {sources.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum source disponivel neste projeto.
              </p>
            )}
            {sources.map((source) => {
              const Icon = typeIcons[source.type] ?? FileText;
              const checked = selectedIds.includes(source.id);
              return (
                <Label
                  key={source.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {source.name}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {source.type}
                  </Badge>
                </Label>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <ManageProfilesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        projectSlug={projectSlug}
        profiles={profiles}
        sources={sources}
      />
    </>
  );
}
