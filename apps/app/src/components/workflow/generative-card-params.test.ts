import { describe, expect, it } from "vitest";

import type { UpstreamParamProfileField } from "@dafthunk/types";

import {
  persistNodeGenerationParams,
  readNodeGenerationParams,
  resolveCardGenerationParams,
} from "./generative-card-params";
import type { WorkflowParameter } from "./workflow-types";

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

describe("readNodeGenerationParams", () => {
  it("returns empty object when params input is missing", () => {
    expect(readNodeGenerationParams([])).toEqual({});
  });

  it("returns a shallow copy of stored params", () => {
    const inputs: WorkflowParameter[] = [
      {
        id: "params",
        name: "params",
        type: "json",
        hidden: true,
        value: { ratio: "16:9" },
      },
    ];
    expect(readNodeGenerationParams(inputs)).toEqual({ ratio: "16:9" });
  });
});

describe("resolveCardGenerationParams", () => {
  const inputs: WorkflowParameter[] = [
    {
      id: "params",
      name: "params",
      type: "json",
      hidden: true,
      value: { ratio: "16:9", stale_key: "drop-me" },
    },
  ];

  it("is hidden without an effective model", () => {
    expect(resolveCardGenerationParams(false, inputs, FIELDS)).toEqual({
      visible: false,
    });
  });

  it("is hidden when there are no generation fields", () => {
    expect(resolveCardGenerationParams(true, inputs, [])).toEqual({
      visible: false,
    });
  });

  it("sanitizes stored params when an effective model exists", () => {
    expect(resolveCardGenerationParams(true, inputs, FIELDS)).toEqual({
      visible: true,
      fields: FIELDS,
      values: { ratio: "16:9", watermark: false },
    });
  });
});

describe("persistNodeGenerationParams", () => {
  it("writes params only", () => {
    expect(
      persistNodeGenerationParams({ ratio: "16:9" }, [])
    ).toEqual([
      {
        id: "params",
        name: "params",
        type: "json",
        hidden: true,
        value: { ratio: "16:9" },
      },
    ]);
  });
});
