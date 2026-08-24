import { afterEach, describe, expect, it } from "vitest";

import {
  clearAiTextDisplaysForTests,
  findAiTextDisplayForMediaId,
  getAiTextDisplay,
  hangAiTextDisplayFromReference,
} from "./ai-text-display-registry";

describe("ai-text-display-registry", () => {
  afterEach(() => {
    clearAiTextDisplaysForTests();
  });

  it("hangs excerpt only and marks ready", () => {
    hangAiTextDisplayFromReference({
      organizationId: "org",
      workflowId: "wf",
      reference: { resourceId: "res-1", mimeType: "text/plain" },
      body: "full body that is longer than a preview",
    });

    const hung = getAiTextDisplay({
      organizationId: "org",
      workflowId: "wf",
      mediaId: "res-1",
    });

    expect(hung?.state).toBe("ready");
    expect(hung?.excerpt).toBeTruthy();
    expect(hung?.excerpt.length).toBeLessThanOrEqual(
      "full body that is longer than a preview".length
    );
    expect(hung && "body" in hung).toBe(false);
    expect(findAiTextDisplayForMediaId("res-1")?.excerpt).toBe(hung?.excerpt);
  });

  it("marks empty when hanging a blank body", () => {
    hangAiTextDisplayFromReference({
      organizationId: "org",
      workflowId: "wf",
      reference: { resourceId: "res-empty", mimeType: "text/plain" },
      body: "   ",
    });

    expect(
      getAiTextDisplay({
        organizationId: "org",
        workflowId: "wf",
        mediaId: "res-empty",
      })?.state
    ).toBe("empty");
  });
});
