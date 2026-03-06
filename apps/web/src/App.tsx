import { AppShell } from "@/components/layout/app-shell";
import { UpdatePrompt } from "@/components/update-prompt";

export default function App() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100svh-2.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-foreground">ARC</h1>
          <p className="text-muted-foreground">App shell ready.</p>
        </div>
      </div>
      <UpdatePrompt />
    </AppShell>
  );
}
