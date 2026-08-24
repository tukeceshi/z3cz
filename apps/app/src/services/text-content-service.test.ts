import { afterEach, describe, expect, it, vi } from "vitest";

const buildApiUrl = vi.fn((path: string) => `https://example.test${path}`);

vi.mock("@/config/api", () => ({
  buildApiUrl: (path: string) => buildApiUrl(path),
}));

function sseResponse(event: unknown): Response {
  return new Response(`data: ${JSON.stringify(event)}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

describe("syncTextContent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    buildApiUrl.mockClear();
  });

  it("calls /{org}/text-content/sync without a doubled /api prefix", async () => {
    const fetchMock = vi.fn(async () => sseResponse({ type: "missing" }));
    vi.stubGlobal("fetch", fetchMock);

    const { syncTextContent } = await import("./text-content-service");
    await syncTextContent({
      organizationId: "org-1",
      resourceId: "res-1",
    });

    expect(buildApiUrl).toHaveBeenCalledWith(
      "/org-1/text-content/sync?resourceId=res-1"
    );
    expect(String(buildApiUrl.mock.calls[0]?.[0])).not.toContain("/api/");
  });

  it("does not treat missing catalog as a version conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse({ type: "missing" }))
    );

    const { syncTextContent } = await import("./text-content-service");
    const result = await syncTextContent({
      organizationId: "org-1",
      resourceId: "res-1",
    });

    expect(result.conflict).toBeUndefined();
    expect(result.downloadUrl).toBeUndefined();
  });

  it("does not treat conflict without dbSha256 as a version conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse({ type: "conflict" }))
    );

    const { syncTextContent } = await import("./text-content-service");
    const result = await syncTextContent({
      organizationId: "org-1",
      resourceId: "res-1",
    });

    expect(result.conflict).toBeUndefined();
  });
});
