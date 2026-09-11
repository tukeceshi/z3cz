import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/allocate-generative-media-resource-id", () => ({
  allocateGenerativeMediaResourceId: () => "resource-ephemeral-1",
}));

vi.mock("@/services/register-media-resource", () => ({
  registerMediaResource: vi.fn(async () => undefined),
}));

const { hangEphemeralUrlAsResource } = await import(
  "./hang-ephemeral-url-as-resource"
);
const { registerMediaResource } = await import("./register-media-resource");

describe("hangEphemeralUrlAsResource", () => {
  beforeEach(() => {
    vi.mocked(registerMediaResource).mockClear();
  });

  it("registers an ephemeral catalog entry and returns a resourceId ref", async () => {
    const result = await hangEphemeralUrlAsResource({
      organizationId: "org-1",
      sourceUrl: "https://cdn.example.com/a.png",
      mimeType: "image/png",
    });

    expect(result).toEqual({
      resourceId: "resource-ephemeral-1",
      mimeType: "image/png",
      kind: "ephemeral",
    });
    expect(registerMediaResource).toHaveBeenCalledWith({
      organizationId: "org-1",
      id: "resource-ephemeral-1",
      kind: "ephemeral",
      mimeType: "image/png",
      upstreamUrl: "https://cdn.example.com/a.png",
      expiresAt: expect.any(String),
    });
    expect(
      vi.mocked(registerMediaResource).mock.calls[0]?.[0]
    ).not.toHaveProperty("storageKey");
  });
});
