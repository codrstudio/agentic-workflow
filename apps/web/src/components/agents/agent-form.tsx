import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAgent } from "@/api/agents";
import { usersQueryOptions } from "@/api/users";
import { ApiError } from "@/lib/api";

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function AgentForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState("");
  const [owner, setOwner] = useState("system");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const { data: users } = useQuery(usersQueryOptions());

  const mutation = useMutation({
    mutationFn: createAgent,
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate({
        to: "/agents/$id",
        params: { id: agent.id },
        search: { tab: "config" },
      });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const body = error.body as Record<string, unknown> | undefined;
        const msg =
          (body?.error as string) ??
          (body?.message as string) ??
          "Erro ao criar agente";
        setBackendError(msg);
      } else {
        setBackendError("Erro ao criar agente");
      }
    },
  });

  function validateSlug(value: string): string | null {
    if (!value.trim()) return "Slug e obrigatorio";
    if (!KEBAB_CASE_RE.test(value))
      return "Slug deve ser kebab-case (ex: meu-agente)";
    return null;
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugError(null);
    setBackendError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const error = validateSlug(slug);
    if (error) {
      setSlugError(error);
      return;
    }

    setBackendError(null);
    mutation.mutate({
      slug,
      owner,
      description: description.trim() || undefined,
      enabled,
    });
  }

  function handleCancel() {
    navigate({ to: "/agents" });
  }

  const ownerOptions = [
    { value: "system", label: "system" },
    ...(users ?? []).map((u) => ({ value: u.slug, label: u.slug })),
  ];

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Novo Agente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="slug">Nome (slug)</Label>
            <Input
              id="slug"
              placeholder="meu-agente"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              aria-invalid={!!(slugError || backendError)}
            />
            {slugError && (
              <p className="text-sm text-destructive">{slugError}</p>
            )}
            {backendError && (
              <p className="text-sm text-destructive">{backendError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner">Owner</Label>
            <Select value={owner} onValueChange={(v) => v && setOwner(v)}>
              <SelectTrigger id="owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ownerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              placeholder="Descreva o agente (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="enabled">Ativo</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando..." : "Criar Agente"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
