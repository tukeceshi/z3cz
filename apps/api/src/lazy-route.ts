import type { Context } from "hono";
import { Hono } from "hono";

import type { ApiContext } from "./context";

/** Preserves org scope when lazy sub-apps are forwarded with a stripped path. */
export const LAZY_ROUTE_ORG_HEADER = "x-dafthunk-organization-id";

interface RouteModule {
  readonly default: Hono<ApiContext>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve the matched mount prefix from the route pattern + request pathname. */
function resolveMountPrefix(c: Context<ApiContext>): string | null {
  const pathname = new URL(c.req.url).pathname;
  const matchedRoute = c.req.matchedRoutes.at(c.req.routeIndex);
  if (!matchedRoute) {
    return null;
  }

  let pattern = matchedRoute.path
    .replace(/\/\*.*$/, "")
    .replace(/\*.*$/, "")
    .replace(/\/+$/, "");

  if (!pattern.includes(":")) {
    return pathname === pattern || pathname.startsWith(`${pattern}/`)
      ? pattern
      : null;
  }

  const regexSource = pattern
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.startsWith(":") ? "[^/]+" : escapeRegex(segment)
    )
    .join("/");

  const match = pathname.match(new RegExp(`^/${regexSource}(?=/|$)`));
  return match?.[0] ?? null;
}

/** First path segment under `/{organizationId}/…` mounts. */
function organizationIdFromMountPrefix(prefix: string | undefined): string | undefined {
  if (!prefix) {
    return undefined;
  }

  const segments = prefix.split("/").filter(Boolean);
  return segments.length >= 2 ? segments[0] : undefined;
}

function buildMountedRequest(c: Context<ApiContext>): Request {
  const url = new URL(c.req.url);
  const prefix = resolveMountPrefix(c);

  if (prefix && url.pathname.startsWith(prefix)) {
    const relative = url.pathname.slice(prefix.length);
    url.pathname =
      relative === "" ? "/" : relative.startsWith("/") ? relative : `/${relative}`;
  }

  const headers = new Headers(c.req.raw.headers);
  const organizationId =
    c.req.param("organizationId") ??
    organizationIdFromMountPrefix(prefix ?? undefined);
  if (organizationId) {
    headers.set(LAZY_ROUTE_ORG_HEADER, organizationId);
  }

  const init: RequestInit = {
    method: c.req.raw.method,
    headers,
  };

  if (c.req.raw.body) {
    init.body = c.req.raw.body;
    init.duplex = "half";
  }

  return new Request(url, init);
}

/**
 * Defers route module loading until the first request hits the mount path.
 * Forwards with a mount-relative pathname so nested Hono routers match correctly.
 */
export function lazyRoute(
  loader: () => Promise<RouteModule>
): Hono<ApiContext> {
  const gate = new Hono<ApiContext>();
  let routeApp: Hono<ApiContext> | undefined;
  let routeLoad: Promise<Hono<ApiContext>> | undefined;

  const resolveRoute = (): Promise<Hono<ApiContext>> => {
    if (routeApp) {
      return Promise.resolve(routeApp);
    }

    routeLoad ??= loader().then((mod) => {
      routeApp = mod.default;
      return routeApp;
    });
    return routeLoad;
  };

  const forward = async (c: Context<ApiContext>) => {
    const sub = await resolveRoute();
    let executionCtx: Parameters<Hono<ApiContext>["fetch"]>[2];
    try {
      executionCtx = c.executionCtx;
    } catch {
      executionCtx = undefined;
    }
    return sub.fetch(buildMountedRequest(c), c.env, executionCtx);
  };

  // Match both the mount root (/types) and nested paths (/types/*).
  gate.all("/", forward);
  gate.all("/*", forward);

  return gate;
}
