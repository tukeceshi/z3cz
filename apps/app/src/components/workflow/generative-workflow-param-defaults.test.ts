import { describe, expect, it, vi } from "vitest";

import type { UpstreamParamProfileField } from "@dafthunk/types";

import {
  commitGenerativeDefaultParams,
  commitGenerativeParamWindow,
  commitNodeGenerationParams,
  mergeWorkflowParamDefaults,
  resolveParamsForNewNode,
} from "./generative-workflow-param-defaults";
import { paramRecordsEqual } from "./param-records-equal";

const FIELDS: readonly UpstreamParamProfileField[] = [
  {
    name: "ratio",
    type: "string",
    enumValues: ["1:1", "16:9"],
    default: "1:1",
  },
  {
    name: "watermark",
    type: "boolean",
    default: false,
  },
];

describe("mergeWorkflowParamDefaults", () => {
  it("keeps fields missing from the incoming save", () => {
    expect(
      mergeWorkflowParamDefaults(
        { ratio: "16:9", watermark: false },
        { ratio: "1:1" }
      )
    ).toEqual({ ratio: "1:1", watermark: false });
  });
});

describe("resolveParamsForNewNode", () => {
  it("uses the model template when nothing is saved", () => {
    expect(resolveParamsForNewNode(FIELDS, undefined)).toEqual({
      ratio: "1:1",
      watermark: false,
    });
  });

  it("applies a saved value only when it fits the field", () => {
    expect(
      resolveParamsForNewNode(FIELDS, {
        ratio: "16:9",
        watermark: true,
        extra: "drop",
      })
    ).toEqual({ ratio: "16:9", watermark: true });
  });

  it("falls back to the model default when the saved value does not fit", () => {
    expect(
      resolveParamsForNewNode(FIELDS, { ratio: "21:9", watermark: true })
    ).toEqual({ ratio: "1:1", watermark: true });
  });

  it("writes nothing when the model has no param fields", () => {
    expect(resolveParamsForNewNode([], { ratio: "16:9" })).toEqual({});
  });
});

describe("paramRecordsEqual", () => {
  it("treats the same keys and values as unchanged", () => {
    expect(paramRecordsEqual({ ratio: "16:9" }, { ratio: "16:9" })).toBe(true);
    expect(paramRecordsEqual({ ratio: "16:9" }, { ratio: "1:1" })).toBe(false);
  });
});

describe("commitGenerativeParamWindow", () => {
  it("splits node and default writes", () => {
    const updateNodeData = vi.fn();
    const onGenerativeDefaultChange = vi.fn();

    commitGenerativeParamWindow({
      next: { ratio: "16:9" },
      fields: FIELDS,
      nodeId: "node-1",
      nodeInputs: [
        { id: "model", name: "model", type: "string", value: "model-a" },
        {
          id: "ai_interface_id",
          name: "ai_interface_id",
          type: "string",
          value: "iface-a",
        },
        { id: "params", name: "params", type: "object", value: {} },
      ],
      updateNodeData,
      modality: "image",
      generativeDefaults: undefined,
      onGenerativeDefaultChange,
    });

    expect(updateNodeData).toHaveBeenCalledTimes(1);
    expect(onGenerativeDefaultChange).toHaveBeenCalledTimes(1);

    commitNodeGenerationParams({
      next: { ratio: "1:1" },
      fields: FIELDS,
      nodeId: "node-1",
      nodeInputs: [
        { id: "params", name: "params", type: "object", value: {} },
      ],
      updateNodeData,
    });

    expect(updateNodeData).toHaveBeenCalledTimes(2);
    expect(onGenerativeDefaultChange).toHaveBeenCalledTimes(1);

    onGenerativeDefaultChange.mockClear();

    commitGenerativeDefaultParams({
      next: { ratio: "1:1" },
      fields: FIELDS,
      nodeId: "node-1",
      nodeInputs: [
        { id: "model", name: "model", type: "string", value: "model-a" },
        {
          id: "ai_interface_id",
          name: "ai_interface_id",
          type: "string",
          value: "iface-a",
        },
        { id: "params", name: "params", type: "object", value: {} },
      ],
      updateNodeData,
      modality: "image",
      generativeDefaults: undefined,
      onGenerativeDefaultChange,
    });

    expect(updateNodeData).toHaveBeenCalledTimes(2);
    expect(onGenerativeDefaultChange).toHaveBeenCalledTimes(1);
  });

  it("skips node writes when sanitized params are unchanged", () => {
    const updateNodeData = vi.fn();

    commitNodeGenerationParams({
      next: { ratio: "1:1", watermark: false },
      fields: FIELDS,
      nodeId: "node-1",
      nodeInputs: [
        {
          id: "params",
          name: "params",
          type: "object",
          value: { ratio: "1:1", watermark: false },
        },
      ],
      updateNodeData,
    });

    expect(updateNodeData).not.toHaveBeenCalled();
  });
});
