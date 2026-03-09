import { useState, useEffect } from "react";
import { Settings2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-badge";
import type { Source, SourceCategory } from "@/hooks/use-sources";

const CATEGORIES: { value: SourceCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "business", label: "Business" },
  { value: "reference", label: "Reference" },
  { value: "config", label: "Config" },
];

interface SourceSettingsSheetProps {
  source: Source | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sourceId: string, updates: {
    category: SourceCategory;
    pinned: boolean;
    auto_include: boolean;
    relevance_tags: string[];
  }) => void;
  saving?: boolean;
}

export function SourceSettingsSheet({
  source,
  open,
  onOpenChange,
  onSave,
  saving,
}: SourceSettingsSheetProps) {
  const [category, setCategory] = useState<SourceCategory>("general");
  const [pinned, setPinned] = useState(false);
  const [autoInclude, setAutoInclude] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (source) {
      setCategory(source.category ?? "general");
      setPinned(source.pinned ?? false);
      setAutoInclude(source.auto_include ?? false);
      setTags(source.relevance_tags ?? []);
      setTagInput("");
    }
  }, [source]);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  const handleSave = () => {
    if (!source) return;
    onSave(source.id, { category, pinned, auto_include: autoInclude, relevance_tags: tags });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configurar contexto
          </SheetTitle>
          <SheetDescription>
            {source?.name ?? "Source"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {/* Category select */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-select">Categoria</Label>
            <select
              id="category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as SourceCategory)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Pinned toggle */}
          <Label className="flex cursor-pointer items-center gap-3">
            <Checkbox
              checked={pinned}
              onCheckedChange={(checked) => setPinned(checked === true)}
            />
            <div>
              <span className="text-sm font-medium">Fixar (pin)</span>
              <p className="text-xs text-muted-foreground">
                Source sempre incluido no contexto
              </p>
            </div>
          </Label>

          {/* Auto-include toggle */}
          <Label className="flex cursor-pointer items-center gap-3">
            <Checkbox
              checked={autoInclude}
              onCheckedChange={(checked) => setAutoInclude(checked === true)}
            />
            <div>
              <span className="text-sm font-medium">Auto-include</span>
              <p className="text-xs text-muted-foreground">
                Pre-selecionado em novas sessoes
              </p>
            </div>
          </Label>

          {/* Relevance tags */}
          <div className="flex flex-col gap-2">
            <Label>Tags de relevancia</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                disabled={!tagInput.trim()}
              >
                +
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs gap-1 pr-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`Remover tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
