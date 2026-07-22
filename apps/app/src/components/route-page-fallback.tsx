import { InsetLoading } from "@/components/inset-loading";
import { Spinner } from "@/components/ui/spinner";

interface RoutePageFallbackProps {
  readonly variant?: "inset" | "full";
}

export type { RoutePageFallbackProps };

export function RoutePageFallback({ variant = "inset" }: RoutePageFallbackProps) {
  if (variant === "full") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2">
        <Spinner className="size-4 text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <InsetLoading />;
}
