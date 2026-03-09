import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { traceQueryOptions } from "@/api/traces";
import type { TraceType } from "@/api/traces";
import { TraceHeader } from "./trace-header";
import { TraceTimeline } from "./trace-timeline";

interface TraceDrawerProps {
  type: TraceType;
  id: string;
  open: boolean;
  onClose: () => void;
}

export function TraceDrawer({ type, id, open, onClose }: TraceDrawerProps) {
  const isMobile = useIsMobile();
  const { data: trace, isLoading } = useQuery({
    ...traceQueryOptions({ type, id }),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex h-[85dvh] flex-col"
            : "flex w-full flex-col sm:max-w-xl"
        }
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Trace</SheetTitle>
          <SheetDescription className="sr-only">
            Detalhes do trace de execucao
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 pt-2">
          {isLoading && <TraceLoadingSkeleton />}
          {trace && (
            <>
              <TraceHeader trace={trace} />
              <TraceTimeline
                steps={trace.steps}
                totalDurationMs={trace.durationMs}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TraceLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
