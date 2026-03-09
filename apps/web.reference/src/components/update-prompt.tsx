import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
      <span className="text-sm">New version available.</span>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Update
      </Button>
    </div>
  );
}
