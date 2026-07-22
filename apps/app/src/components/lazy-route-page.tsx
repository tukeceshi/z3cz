import {
  type ComponentType,
  Suspense,
  lazy,
} from "react";

import {
  RoutePageFallback,
  type RoutePageFallbackProps,
} from "@/components/route-page-fallback";

type LazyModule = Record<string, ComponentType<object> | unknown>;

export function lazyRoutePage(
  loader: () => Promise<LazyModule>,
  exportName: string,
  fallback: RoutePageFallbackProps["variant"] = "inset"
): ComponentType<object> {
  const LazyPage = lazy(async () => {
    const module = await loader();
    const component = module[exportName];
    if (typeof component !== "function") {
      throw new Error(`lazyRoutePage: missing export "${exportName}"`);
    }
    return { default: component as ComponentType<object> };
  });

  function LazyRoutePage() {
    return (
      <Suspense fallback={<RoutePageFallback variant={fallback} />}>
        <LazyPage />
      </Suspense>
    );
  }

  return LazyRoutePage;
}
