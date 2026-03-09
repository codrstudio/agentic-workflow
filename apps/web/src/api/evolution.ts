import { request } from "@/lib/api";

export interface EvolutionInstance {
  instanceName: string;
  instanceId: string;
  state: "open" | "close" | "connecting";
  since: number;
  previousState: string | null;
  owner: string | null;
  profileName: string | null;
  durationMs: number;
}

interface EvolutionEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

export async function createEvolutionInstance(
  instanceName: string,
): Promise<EvolutionEnvelope<unknown>> {
  return request<EvolutionEnvelope<unknown>>(
    "/connectors/evolution/instances",
    {
      method: "POST",
      body: JSON.stringify({ instanceName }),
    },
  );
}

export async function getEvolutionQR(
  instanceName: string,
): Promise<EvolutionEnvelope<{ base64: string; pairingCode?: string }>> {
  return request<EvolutionEnvelope<{ base64: string; pairingCode?: string }>>(
    `/connectors/evolution/instances/${instanceName}/qr`,
  );
}

export async function getEvolutionInstances(): Promise<
  EvolutionEnvelope<EvolutionInstance[]>
> {
  return request<EvolutionEnvelope<EvolutionInstance[]>>(
    "/connectors/evolution/instances",
  );
}

export async function getEvolutionInstance(
  instanceName: string,
): Promise<EvolutionEnvelope<EvolutionInstance>> {
  return request<EvolutionEnvelope<EvolutionInstance>>(
    `/connectors/evolution/instances/${instanceName}`,
  );
}
