import { Link, useParams } from "@tanstack/react-router";
import { ClipboardCheck, FileText, GitBranch, MessageSquare, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Sources", to: "/projects/$projectId/sources" as const, icon: FileText },
  { label: "Chat", to: "/projects/$projectId/chat" as const, icon: MessageSquare },
  { label: "Artifacts", to: "/projects/$projectId/artifacts" as const, icon: Package },
  { label: "Pipeline", to: "/projects/$projectId/pipeline" as const, icon: GitBranch },
  { label: "Reviews", to: "/projects/$projectId/reviews" as const, icon: ClipboardCheck },
];

export function ProjectNav() {
  const { projectId } = useParams({ from: "/_authenticated/projects/$projectId" });

  return (
    <nav className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-3 overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          params={{ projectId }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          activeProps={{
            className: "bg-muted text-foreground shadow-sm",
          }}
          activeOptions={{ exact: false }}
        >
          <tab.icon className="size-4" />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
