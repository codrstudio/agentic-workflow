import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle } from "lucide-react";
import {
  systemInfoQueryOptions,
  systemEnvQueryOptions,
} from "@/api/settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const apiKeyLabels: Record<string, string> = {
  OPENROUTER_API_KEY: "OpenRouter",
  OPENAI_API_KEY: "OpenAI",
};

export function SystemInfo() {
  const { data: info, isLoading: infoLoading } = useQuery(
    systemInfoQueryOptions()
  );
  const { data: env, isLoading: envLoading } = useQuery(
    systemEnvQueryOptions()
  );

  if (infoLoading || envLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!info || !env) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versao</CardTitle>
          <CardDescription>Versao do backbone</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{info.version}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Node.js</CardTitle>
          <CardDescription>Versao do runtime</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{info.nodeVersion}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plataforma</CardTitle>
          <CardDescription>Sistema operacional</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{info.platform}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>Status das chaves de API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(apiKeyLabels).map(([key, label]) => {
              const present = env[key as keyof typeof env];
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Badge variant={present ? "secondary" : "outline"}>
                    {present ? (
                      <CheckCircle className="mr-1 size-3" />
                    ) : (
                      <XCircle className="mr-1 size-3" />
                    )}
                    {present ? "Presente" : "Ausente"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Diretorio de Contexto</CardTitle>
          <CardDescription>Caminho do diretorio de contexto</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="text-sm bg-muted px-2 py-1 rounded">
            {info.contextDir}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
