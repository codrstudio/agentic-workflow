import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="mt-auto flex items-center gap-4">
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="ml-auto h-3.5 w-20" />
      </div>
    </div>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}
