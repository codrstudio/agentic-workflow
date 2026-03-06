import { Outlet, useMatches } from "@tanstack/react-router";

export function ProjectsPage() {
  const matches = useMatches();
  const hasChildRoute = matches.length > 3;

  if (hasChildRoute) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-[calc(100svh-2.5rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <p className="text-muted-foreground">Project list will be here.</p>
      </div>
    </div>
  );
}
