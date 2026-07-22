import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import type { ApiContext } from "./context";
import { lazyRoute, LAZY_ROUTE_ORG_HEADER } from "./lazy-route";

describe("lazyRoute", () => {
  it("forwards mount-relative paths for org-scoped routes", async () => {
    const sub = new Hono<ApiContext>();
    sub.get("/", (c) => c.json({ scope: "list" }));
    sub.get("/:id", (c) => c.json({ scope: "detail", id: c.req.param("id") }));

    const app = new Hono<ApiContext>();
    app.route(
      "/:organizationId/workflows",
      lazyRoute(async () => ({ default: sub }))
    );

    const list = await app.request(
      "http://localhost/org-123/workflows",
      { method: "GET" }
    );
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual({ scope: "list" });

    const detail = await app.request(
      "http://localhost/org-123/workflows/wf-456",
      { method: "GET" }
    );
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toEqual({
      scope: "detail",
      id: "wf-456",
    });
  });

  it("forwards mount-relative paths for static routes", async () => {
    const sub = new Hono<ApiContext>();
    sub.get("/", (c) => c.text("types"));

    const app = new Hono<ApiContext>();
    app.route("/types", lazyRoute(async () => ({ default: sub })));

    const response = await app.request("http://localhost/types", {
      method: "GET",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("types");
  });

  it("forwards nested paths and org header for platform-ai mounts", async () => {
    const sub = new Hono<ApiContext>();
    sub.use("*", async (c, next) => {
      const organizationId = c.req.header(LAZY_ROUTE_ORG_HEADER);
      if (organizationId) {
        c.set("organizationId", organizationId);
      }
      if (!c.get("organizationId")) {
        return c.json({ error: "missing org" }, 400);
      }
      await next();
    });
    sub.get("/storage-status", (c) =>
      c.json({ configured: true, org: c.get("organizationId") })
    );

    const app = new Hono<ApiContext>();
    app.route(
      "/:organizationId/platform-ai",
      lazyRoute(async () => ({ default: sub }))
    );

    const response = await app.request(
      "http://localhost/org-123/platform-ai/storage-status",
      { method: "GET" }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      configured: true,
      org: "org-123",
    });
  });
});
