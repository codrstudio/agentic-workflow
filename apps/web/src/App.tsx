import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">ARC</h1>
        <p className="text-muted-foreground">App shell ready.</p>
        <div className="flex gap-2">
          <Button>Get Started</Button>
          <Button variant="outline">Learn More</Button>
        </div>
      </div>
    </div>
  );
}
