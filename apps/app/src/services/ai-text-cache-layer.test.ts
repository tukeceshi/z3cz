import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAiTextDisplaysForTests, getAiTextDisplay } from "./ai-text-display-registry";

const ensureAiTextCached = vi.fn();
const readAiTextContent = vi.fn();

vi.mock("./ensure-ai-text-cached", () => ({
  ensureAiTextCached: (...args: unknown[]) => ensureAiTextCached(...args),
}));

vi.mock("./ai-text-storage-service", () => ({
  readAiTextContent: (...args: unknown[]) => readAiTextContent(...args),
}));

describe("ai-text-cache-layer", () => {
  afterEach(() => {
    clearAiTextDisplaysForTests();
    ensureAiTextCached.mockReset();
    readAiTextContent.mockReset();
  });

  it("readyAiTextStaging hangs excerpt and not a second full-body copy", async () => {
    ensureAiTextCached.mockResolvedValue(true);
    readAiTextContent.mockResolvedValue("hello from staging");

    const { readyAiTextStaging, readAiTextFullBodyFromStaging } = await import(
      "./ai-text-cache-layer"
    );

    const result = await readyAiTextStaging({
      organizationId: "org",
      workflowId: "wf",
      reference: { resourceId: "res-1", mimeType: "text/plain" },
      workflowSha: "abc",
    });

    expect(result.state).toBe("ready");
    expect(result.body).toBe("hello from staging");
    expect(
      getAiTextDisplay({
        organizationId: "org",
        workflowId: "wf",
        mediaId: "res-1",
      })
    ).toEqual({
      excerpt: "hello from staging",
      state: "ready",
    });

    readAiTextContent.mockResolvedValue("hello from staging");
    await expect(
      readAiTextFullBodyFromStaging({
        organizationId: "org",
        workflowId: "wf",
        reference: { resourceId: "res-1", mimeType: "text/plain" },
      })
    ).resolves.toBe("hello from staging");
  });

  it("readyAiTextStaging marks failed when cache miss and no body", async () => {
    ensureAiTextCached.mockResolvedValue(false);
    readAiTextContent.mockResolvedValue(null);

    const { readyAiTextStaging } = await import("./ai-text-cache-layer");
    const result = await readyAiTextStaging({
      organizationId: "org",
      workflowId: "wf",
      reference: { resourceId: "res-miss", mimeType: "text/plain" },
    });

    expect(result.state).toBe("failed");
    expect(
      getAiTextDisplay({
        organizationId: "org",
        workflowId: "wf",
        mediaId: "res-miss",
      })?.state
    ).toBe("failed");
  });
});
