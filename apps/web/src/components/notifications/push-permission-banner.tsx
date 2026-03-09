import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { vapidKeyQueryOptions, subscribeToPush } from "@/api/notifications";

const LS_KEY = "push-permission-choice";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: vapidData } = useQuery(vapidKeyQueryOptions());

  useEffect(() => {
    if (!vapidData?.publicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const choice = localStorage.getItem(LS_KEY);
    if (choice) return;

    if (Notification.permission === "granted") {
      // Already granted — try to subscribe silently
      registerSubscription(vapidData.publicKey);
      return;
    }

    if (Notification.permission === "denied") {
      localStorage.setItem(LS_KEY, "denied");
      return;
    }

    setVisible(true);
  }, [vapidData]);

  async function registerSubscription(publicKey: string) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        localStorage.setItem(LS_KEY, "accepted");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      await subscribeToPush({
        endpoint: json.endpoint!,
        keys: {
          p256dh: json.keys!["p256dh"]!,
          auth: json.keys!["auth"]!,
        },
      });

      localStorage.setItem(LS_KEY, "accepted");
    } catch (err) {
      console.error("[push] subscription failed:", err);
    }
  }

  async function handleAccept() {
    if (!vapidData?.publicKey) return;
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registerSubscription(vapidData.publicKey);
        toast.success("Notificacoes push ativadas");
        localStorage.setItem(LS_KEY, "accepted");
      } else {
        localStorage.setItem(LS_KEY, "denied");
      }
    } catch (err) {
      console.error("[push] permission request failed:", err);
      toast.error("Erro ao ativar notificacoes push");
    } finally {
      setLoading(false);
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(LS_KEY, "dismissed");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="border-b bg-muted/50 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <BellRing className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm text-muted-foreground">
          Receba notificacoes mesmo quando o Hub estiver fechado.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={handleAccept} disabled={loading}>
            {loading ? "Ativando..." : "Ativar notificacoes"}
          </Button>
          <Button size="icon" variant="ghost" onClick={handleDismiss} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
