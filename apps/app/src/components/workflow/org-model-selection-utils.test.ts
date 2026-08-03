import { describe, expect, it } from "vitest";

import { buildOrgModelOptionId } from "@dafthunk/types";

import {
  clearModelBindingInputs,
  persistModelBindingToInputs,
  pickInitialModelBinding,
  readLastUsedModelBinding,
  rememberModelBinding,
  resolveHydrateModelBindingAction,
  resolveHistoryModelBindingFromItems,
  writeLastUsedModelBinding,
} from "./org-model-selection-utils";
import type { WorkflowParameter } from "./workflow-types";

function binding(
  interfaceId: string,
  canonicalId: string,
  selectable = true
) {
  return {
    optionId: buildOrgModelOptionId(interfaceId, canonicalId),
    canonicalId,
    interfaceId,
    selectable,
  };
}

describe("resolveHydrateModelBindingAction", () => {
  it("fills missing interface id when the model has a single binding", () => {
    expect(
      resolveHydrateModelBindingAction(
        [binding("iface-a", "doubao-seedream-5")],
        "doubao-seedream-5",
        ""
      )
    ).toEqual({
      kind: "fill_interface",
      interfaceId: "iface-a",
    });
  });

  it("does not guess interface when multiple bindings share a model", () => {
    expect(
      resolveHydrateModelBindingAction(
        [
          binding("iface-a", "doubao-seedream-5"),
          binding("iface-b", "doubao-seedream-5"),
        ],
        "doubao-seedream-5",
        ""
      )
    ).toEqual({ kind: "none" });
  });

  it("clears stale model and interface pairs", () => {
    expect(
      resolveHydrateModelBindingAction(
        [binding("iface-a", "doubao-seedream-5")],
        "doubao-seedream-5",
        "iface-missing"
      )
    ).toEqual({ kind: "clear" });
  });
});

describe("pickInitialModelBinding", () => {
  it("prefers the latest history binding over platform defaults", () => {
    const models = [
      binding("iface-default", "deepseek-v4-flash"),
      binding("iface-history", "doubao-seedream-5"),
    ];

    expect(
      pickInitialModelBinding(models, {
        canonicalId: "doubao-seedream-5",
        interfaceId: "iface-history",
      })?.optionId
    ).toBe(buildOrgModelOptionId("iface-history", "doubao-seedream-5"));
  });

  it("prefers history over last used binding", () => {
    const models = [
      binding("iface-history", "model-history"),
      binding("iface-last", "model-last"),
    ];

    expect(
      pickInitialModelBinding(
        models,
        {
          canonicalId: "model-history",
          interfaceId: "iface-history",
        },
        {
          canonicalId: "model-last",
          interfaceId: "iface-last",
        }
      )?.optionId
    ).toBe(buildOrgModelOptionId("iface-history", "model-history"));
  });

  it("uses last used binding when history is missing", () => {
    const models = [
      binding("iface-default", "deepseek-v4-flash"),
      binding("iface-last", "gpt-image-1"),
    ];

    expect(
      pickInitialModelBinding(
        models,
        undefined,
        {
          canonicalId: "gpt-image-1",
          interfaceId: "iface-last",
        }
      )?.optionId
    ).toBe(buildOrgModelOptionId("iface-last", "gpt-image-1"));
  });
});

describe("last used model binding storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips last used binding per org and modality", () => {
    writeLastUsedModelBinding("org-1", "image", {
      canonicalId: "gpt-image-1",
      interfaceId: "iface-gpt",
    });

    expect(readLastUsedModelBinding("org-1", "image")).toEqual({
      canonicalId: "gpt-image-1",
      interfaceId: "iface-gpt",
    });
    expect(readLastUsedModelBinding("org-1", "text")).toBeUndefined();
    expect(readLastUsedModelBinding("org-2", "image")).toBeUndefined();
  });

  it("rememberModelBinding ignores empty org ids", () => {
    rememberModelBinding(undefined, "image", {
      canonicalId: "gpt-image-1",
      interfaceId: "iface-gpt",
    });

    expect(sessionStorage.length).toBe(0);
  });
});

describe("resolveHistoryModelBindingFromItems", () => {
  it("reads the selected history item binding", () => {
    expect(
      resolveHistoryModelBindingFromItems({
        selectedId: "row-2",
        items: [
          {
            id: "row-1",
            platformModelId: "model-a",
            aiInterfaceId: "iface-a",
          },
          {
            id: "row-2",
            platformModelId: "model-b",
            aiInterfaceId: "iface-b",
          },
        ],
      })
    ).toEqual({
      canonicalId: "model-b",
      interfaceId: "iface-b",
    });
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

describe("clearModelBindingInputs", () => {
  it("clears model and ai_interface_id together", () => {
    const inputs: WorkflowParameter[] = [
      {
        id: "model",
        name: "model",
        type: "string",
        value: "doubao-seedream-5",
      },
      {
        id: "ai_interface_id",
        name: "ai_interface_id",
        type: "string",
        value: "iface-a",
      },
      {
        id: "prompt",
        name: "prompt",
        type: "string",
        value: "hello",
      },
    ];

    expect(clearModelBindingInputs(inputs)).toEqual([
      { ...inputs[0], value: "" },
      { ...inputs[1], value: "" },
      inputs[2],
    ]);
  });
});
