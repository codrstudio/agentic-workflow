import { Link } from "@tanstack/react-router";
import { Calendar, FileText, MessageSquare, Package } from "lucide-react";
import type { Project } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  className?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncate(text: string | undefined, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

export function ProjectCard({ project, className }: ProjectCardProps) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.slug }}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {truncate(project.description, 120)}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Sources">
          <FileText className="h-3.5 w-3.5" />
          <span>0</span>
        </span>
        <span className="flex items-center gap-1" title="Sessions">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>0</span>
        </span>
        <span className="flex items-center gap-1" title="Artifacts">
          <Package className="h-3.5 w-3.5" />
          <span>0</span>
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(project.created_at)}</span>
        </span>
      </div>
    </Link>
  );
}
