import { describe, expect, it } from "vitest";

import { buildOrgModelOptionId } from "@dafthunk/types";

import {
  applyHistoryItemModelBinding,
  persistGenerativeBindingWithParams,
  persistModelBindingToInputs,
  readModelSelectionRecord,
  resolveEffectiveGenerativeModel,
  resolveModelCandidate,
  resolveModelCardState,
  resolveSelectedModelBinding,
} from "./org-model-selection-utils";
import type { WorkflowParameter } from "./workflow-types";

function binding(
  interfaceId: string,
  canonicalId: string,
  selectable = true,
  instanceId = canonicalId
) {
  return {
    optionId: buildOrgModelOptionId(interfaceId, instanceId),
    instanceId,
    canonicalId,
    interfaceId,
    selectable,
  };
}

describe("readModelSelectionRecord", () => {
  it("requires both model and interface id", () => {
    expect(
      readModelSelectionRecord({ modelId: "gpt-image-1", interfaceId: "iface-a" })
    ).toEqual({
      canonicalId: "gpt-image-1",
      interfaceId: "iface-a",
    });
    expect(
      readModelSelectionRecord({ modelId: "gpt-image-1", interfaceId: "" })
    ).toBeUndefined();
  });
});

describe("resolveEffectiveGenerativeModel", () => {
  const models = [
    binding("iface-a", "doubao-seedream-5"),
    binding("iface-b", "gpt-image-1"),
  ];

  it("prefers node binding when valid", () => {
    expect(
      resolveEffectiveGenerativeModel({
        nodeBinding: { canonicalId: "gpt-image-1", interfaceId: "iface-b" },
        workflowDefault: { canonicalId: "doubao-seedream-5", interfaceId: "iface-a" },
        models,
      })
    ).toEqual({ model: models[1], source: "node" });
  });

  it("falls back to workflow default when node binding is missing", () => {
    expect(
      resolveEffectiveGenerativeModel({
        nodeBinding: undefined,
        workflowDefault: { canonicalId: "gpt-image-1", interfaceId: "iface-b" },
        models,
      })
    ).toEqual({ model: models[1], source: "workflow" });
  });

  it("falls back to first selectable model in list order", () => {
    expect(
      resolveEffectiveGenerativeModel({
        nodeBinding: undefined,
        workflowDefault: undefined,
        models,
      })
    ).toEqual({ model: models[0], source: "list" });
  });

  it("returns undefined when selection is stale and no fallback exists", () => {
    expect(
      resolveEffectiveGenerativeModel({
        nodeBinding: { canonicalId: "missing", interfaceId: "iface-a" },
        workflowDefault: undefined,
        models: [],
      })
    ).toBeUndefined();
  });
});

describe("resolveModelCandidate", () => {
  const models = [
    binding("iface-a", "doubao-seedream-5"),
    binding("iface-b", "gpt-image-1"),
  ];

  it("matches selection record when present", () => {
    expect(
      resolveModelCandidate(
        { canonicalId: "gpt-image-1", interfaceId: "iface-b" },
        models
      )
    ).toBe(models[1]);
  });

  it("returns first selectable model without selection", () => {
    expect(resolveModelCandidate(undefined, models)).toBe(models[0]);
  });

  it("returns undefined when selection is stale", () => {
    expect(
      resolveModelCandidate(
        { canonicalId: "missing", interfaceId: "iface-a" },
        models
      )
    ).toBeUndefined();
  });
});

describe("resolveModelCardState", () => {
  const models = [
    binding("iface-a", "doubao-seedream-5"),
    binding("iface-b", "gpt-image-1"),
  ];

  it("returns ready when an effective model is resolved", () => {
    expect(
      resolveModelCardState(
        resolveEffectiveGenerativeModel({
          nodeBinding: { canonicalId: "gpt-image-1", interfaceId: "iface-b" },
          workflowDefault: undefined,
          models,
        }),
        false
      )
    ).toEqual({
      status: "ready",
      model: models[1],
      source: "node",
    });
  });

  it("returns pick when no effective model exists", () => {
    expect(
      resolveModelCardState(
        resolveEffectiveGenerativeModel({
          nodeBinding: { canonicalId: "missing", interfaceId: "iface-a" },
          workflowDefault: undefined,
          models: [binding("iface-a", "disabled", false)],
        }),
        false
      )
    ).toEqual({ status: "pick" });
  });

  it("returns loading while models are loading", () => {
    expect(resolveModelCardState(undefined, true)).toEqual({ status: "loading" });
  });
});

describe("resolveSelectedModelBinding", () => {
  it("matches exact interface id only", () => {
    const models = [
      binding("iface-a", "doubao-seedream-5"),
      binding("iface-b", "doubao-seedream-5"),
    ];

    expect(
      resolveSelectedModelBinding(models, "doubao-seedream-5", "iface-b")
    ).toBe(models[1]);
    expect(
      resolveSelectedModelBinding(models, "doubao-seedream-5", "iface-missing")
    ).toBeUndefined();
  });
});

describe("persistModelBindingToInputs", () => {
  it("writes model and ai_interface_id together", () => {
    const inputs: WorkflowParameter[] = [];

    expect(
      persistModelBindingToInputs(inputs, {
        canonicalId: "doubao-seedream-5",
        interfaceId: "iface-a",
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

describe("persistGenerativeBindingWithParams", () => {
  it("writes model binding and params together", () => {
    expect(
      persistGenerativeBindingWithParams([], {
        canonicalId: "gpt-image-1",
        interfaceId: "iface-a",
      }, { ratio: "16:9" })
    ).toEqual([
      {
        id: "model",
        name: "model",
        type: "string",
        hidden: true,
        value: "gpt-image-1",
      },
      {
        id: "ai_interface_id",
        name: "ai_interface_id",
        type: "string",
        hidden: true,
        value: "iface-a",
      },
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

describe("applyHistoryItemModelBinding", () => {
  it("writes model selection record from usage history item", () => {
    const inputs: WorkflowParameter[] = [];
    expect(
      applyHistoryItemModelBinding(inputs, {
        platformModelId: "gpt-image-1",
        aiInterfaceId: "iface-a",
      })
    ).toEqual(
      persistModelBindingToInputs(inputs, {
        canonicalId: "gpt-image-1",
        interfaceId: "iface-a",
      })
    );
  });

  it("ignores history items without interface id", () => {
    expect(
      applyHistoryItemModelBinding([], {
        platformModelId: "gpt-image-1",
      })
    ).toEqual([]);
  });
});
