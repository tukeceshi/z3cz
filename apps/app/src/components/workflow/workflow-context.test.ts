import { describe, expect, it } from "vitest";

import {
  upsertNodeInputValue,
  upsertNodeInputValues,
} from "./workflow-context";
import type { WorkflowParameter } from "./workflow-types";

describe("upsertNodeInputValue", () => {
  it("appends hidden inputs when the slot is missing", () => {
    const inputs: WorkflowParameter[] = [
      {
        id: "model",
        name: "model",
        type: "string",
        value: "deepseek-v4-flash",
      },
    ];

    expect(
      upsertNodeInputValue(inputs, "ai_interface_id", "iface-a")
    ).toEqual([
      inputs[0],
      {
        id: "ai_interface_id",
        name: "ai_interface_id",
        type: "string",
        hidden: true,
        value: "iface-a",
      },
    ]);
  });
});

describe("upsertNodeInputValues", () => {
  it("writes multiple input values in one pass", () => {
    const inputs: WorkflowParameter[] = [];

    expect(
      upsertNodeInputValues(inputs, {
        model: "doubao-seedream-5",
        ai_interface_id: "iface-a",
      })
    ).toEqual([
      {
        id: "model",
        name: "model",
        type: "string",
        hidden: true,
        value: "doubao-seedream-5",
      },
      {
        id: "ai_interface_id",
        name: "ai_interface_id",
        type: "string",
        hidden: true,
        value: "iface-a",
      },
    ]);
  });
});
