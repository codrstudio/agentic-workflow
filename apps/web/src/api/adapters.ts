import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Adapter {
  slug: string;
  connector: string;
  source: string;
  name: string;
  description: string;
  policy: string;
  enabled: boolean;
  credential: Record<string, unknown>;
  options: Record<string, unknown>;
}

export const adaptersQueryOptions = () =>
  queryOptions({
    queryKey: ["adapters"],
    queryFn: () => request<{ adapters: Adapter[] }>("/adapters").then((r) => r.adapters),
  });
