import { describe, expect, it } from "vitest";

import {
  rememberAiMediaCacheWorkflowName,
  resolveAiMediaCacheWorkflowName,
} from "./ai-media-cache-workflow-name";

describe("resolveAiMediaCacheWorkflowName", () => {
  it("prefers a real name over the workflow id", () => {
    rememberAiMediaCacheWorkflowName("org-1", "wf-1", "春日海报");
    expect(resolveAiMediaCacheWorkflowName("org-1", "wf-1")).toBe("春日海报");
    expect(resolveAiMediaCacheWorkflowName("org-1", "wf-1", "wf-1")).toBe(
      "春日海报"
    );
  });

  it("falls back to the workflow id", () => {
    expect(resolveAiMediaCacheWorkflowName("org-1", "wf-missing")).toBe(
      "wf-missing"
    );
  });
});
