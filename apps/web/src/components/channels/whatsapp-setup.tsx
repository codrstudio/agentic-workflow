import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, CheckCircle2, Smartphone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEvolutionInstance,
  getEvolutionQR,
  getEvolutionInstance,
} from "@/api/evolution";

interface WhatsAppSetupProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

export function WhatsAppSetup({ onComplete }: WhatsAppSetupProps) {
  const [step, setStep] = useState<Step>(1);
  const [instanceName, setInstanceName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrBase64, setQrBase64] = useState("");
  const [pairedNumber, setPairedNumber] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // --- Step 1: Create instance ---
  async function handleCreateInstance(e: React.FormEvent) {
    e.preventDefault();
    const name = instanceName.trim();
    if (!name) {
      setError("Nome da instancia e obrigatorio");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await createEvolutionInstance(name);
      if (!res.ok) {
        setError(res.error ?? "Erro ao criar instancia");
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar instancia");
    } finally {
      setLoading(false);
    }
  }

  // --- Step 2: QR Code polling ---
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQR = useCallback(async () => {
    try {
      const res = await getEvolutionQR(instanceName.trim());
      if (res.ok && res.data?.base64) {
        setQrBase64(res.data.base64);
      }
    } catch {
      // QR might not be ready yet, ignore
    }
  }, [instanceName]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await getEvolutionInstance(instanceName.trim());
      if (res.ok && res.data?.state === "open") {
        setPairedNumber(res.data.owner ?? res.data.profileName ?? null);
        setStep(3);
      }
    } catch {
      // Ignore — will retry
    }
  }, [instanceName]);

  useEffect(() => {
    if (step !== 2) return;

    // Initial QR fetch
    fetchQR();

    // Poll status every 5s
    pollTimerRef.current = setInterval(checkStatus, 5000);

    // Refresh QR every 30s
    qrRefreshTimerRef.current = setInterval(fetchQR, 30000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (qrRefreshTimerRef.current) clearInterval(qrRefreshTimerRef.current);
    };
  }, [step, fetchQR, checkStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (qrRefreshTimerRef.current) clearInterval(qrRefreshTimerRef.current);
    };
  }, []);

  // --- Step 3: Complete ---
  function handleFinish() {
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    queryClient.invalidateQueries({ queryKey: ["adapters"] });
    onComplete();
  }

  // --- Step indicator ---
  const steps = [
    { num: 1, label: "Instancia" },
    { num: 2, label: "QR Code" },
    { num: 3, label: "Conectado" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                step === s.num
                  ? "bg-primary text-primary-foreground"
                  : step > s.num
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.num ? <CheckCircle2 className="size-4" /> : s.num}
            </div>
            <span
              className={`text-sm ${step === s.num ? "font-medium" : "text-muted-foreground"}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="mx-1 h-px w-8 bg-border" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 1 && (
        <form onSubmit={handleCreateInstance} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da instancia</Label>
            <Input
              id="instance-name"
              placeholder="ex: meu-whatsapp"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Escolha um nome unico para identificar esta conexao WhatsApp.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !instanceName.trim()}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Criar instancia
          </Button>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center space-y-4">
          <Smartphone className="size-10 text-muted-foreground" />
          <p className="text-center text-sm text-muted-foreground">
            Abra o WhatsApp no celular, va em{" "}
            <strong>Dispositivos Conectados</strong> e escaneie o QR Code
            abaixo.
          </p>
          <div className="flex items-center justify-center rounded-xl border bg-white p-4">
            {qrBase64 ? (
              <QRCodeSVG value={qrBase64} size={256} level="M" />
            ) : (
              <div className="flex size-64 items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Aguardando leitura do QR Code...
          </div>
          <p className="text-xs text-muted-foreground">
            O QR Code atualiza automaticamente a cada 30 segundos.
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center space-y-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Wifi className="size-8 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold">Conectado</h3>
            {pairedNumber && (
              <p className="text-sm text-muted-foreground">
                Numero pareado: <strong>{pairedNumber}</strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Instancia <strong>{instanceName.trim()}</strong> esta pronta para
              uso.
            </p>
          </div>
          <Button onClick={handleFinish}>Concluir</Button>
        </div>
      )}
    </div>
  );
}
