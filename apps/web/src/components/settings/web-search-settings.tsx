import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  webSearchSettingsQueryOptions,
  updateWebSearchProvider,
  type WebSearchProvider,
} from "@/api/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const providerOptions: { value: WebSearchProvider; label: string }[] = [
  { value: "duckduckgo", label: "DuckDuckGo" },
  { value: "brave", label: "Brave" },
  { value: "none", label: "Nenhum" },
];

export function WebSearchSettings() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery(webSearchSettingsQueryOptions());

  const mutation = useMutation({
    mutationFn: updateWebSearchProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "web-search"] });
      toast.success("Provedor de busca atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar provedor de busca");
    },
  });

  function handleChange(value: WebSearchProvider | null) {
    if (value) mutation.mutate(value);
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full max-w-md rounded-xl" />;
  }

  if (!config) return null;

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Provedor de busca</CardTitle>
        <CardDescription>
          Selecione o provedor usado para buscas na web pelos agentes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={config.provider}
          onValueChange={handleChange}
          disabled={mutation.isPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um provedor" />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
