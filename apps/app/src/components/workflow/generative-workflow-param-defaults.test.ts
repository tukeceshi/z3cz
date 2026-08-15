import { describe, expect, it } from "vitest";

import type { UpstreamParamProfileField } from "@dafthunk/types";

import {
  mergeWorkflowParamDefaults,
  paramRecordsEqual,
  resolveParamsForNewNode,
} from "./generative-workflow-param-defaults";

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
