import { describe, expect, it } from "vitest";

import { applyWorkflowNodeDataUpdate } from "./apply-workflow-node-data-update";
import type { WorkflowNodeType } from "./workflow-types";

function node(
  id: string,
  data: Partial<WorkflowNodeType> = {}
): { id: string; data: WorkflowNodeType } {
  return {
    id,
    data: {
      name: id,
      inputs: [],
      outputs: [],
      executionState: "idle",
      ...data,
    },
  };
}

describe("applyWorkflowNodeDataUpdate", () => {
  it("patches an existing node without dropping siblings", () => {
    const nodes = [node("a"), node("b")];
    const next = applyWorkflowNodeDataUpdate(nodes, "a", {
      name: "hung",
    });

    expect(next[0]?.data.name).toBe("hung");
    expect(next[1]?.id).toBe("b");
  });

  it("keeps prior node data when the next create uses the updated list", () => {
    let nodes = [node("a")];
    nodes = applyWorkflowNodeDataUpdate(nodes, "a", { name: "kept" });
    const afterCreate = [...nodes, node("b")];

    expect(afterCreate[0]?.data.name).toBe("kept");
    expect(afterCreate[1]?.id).toBe("b");
  });
});
