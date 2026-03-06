import { FileText, Code, Link, FileType, File } from "lucide-react";
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
import type { Source } from "@/hooks/use-sources";

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
}

export function SourceContextSheet({
  open,
  onOpenChange,
  sources,
  selectedIds,
  onSelectionChange,
}: SourceContextSheetProps) {
  const toggleSource = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Contexto de Sources</SheetTitle>
          <SheetDescription>
            Selecione os sources que o assistente deve usar como contexto.
          </SheetDescription>
        </SheetHeader>
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
  );
}
