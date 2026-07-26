import { describe, expect, it } from "vitest";

import { buildWorkflowClientRequestId } from "./workflow-generation-job-tracker";

describe("buildWorkflowClientRequestId", () => {
  it("prefers execution id when present", () => {
    expect(
      buildWorkflowClientRequestId({
        executionId: "exec-1",
        workflowId: "wf-1",
        nodeId: "node-1",
        modality: "video",
      })
    ).toBe("workflow:exec-1:node-1:video");
  });

  it("falls back to workflow id", () => {
    expect(
      buildWorkflowClientRequestId({
        workflowId: "wf-1",
        nodeId: "node-2",
        modality: "image",
      })
    ).toBe("workflow:wf-1:node-2:image");
  });
});
