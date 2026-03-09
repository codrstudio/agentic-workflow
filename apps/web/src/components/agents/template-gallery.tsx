import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TemplateCard } from "@/components/agents/template-card";
import type { AgentTemplate } from "@/api/templates";

interface TemplateGalleryProps {
  templates: AgentTemplate[];
  onSelect: (slug: string) => void;
}

export function TemplateGallery({ templates, onSelect }: TemplateGalleryProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const groups = useMemo(() => {
    const map = new Map<string, AgentTemplate[]>();
    for (const t of filtered) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {groups.size === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template encontrado.</p>
      ) : (
        Array.from(groups.entries()).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground">
              {category}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <TemplateCard
                  key={t.slug}
                  template={t}
                  onSelect={() => onSelect(t.slug)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
