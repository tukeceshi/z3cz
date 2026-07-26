import type {
  OrgTextModelOption,
  PlatformAiModelGroup,
} from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  buildModelBrandSections,
  resolveActiveBrandId,
  resolveBrandFlyoutPlacement,
} from "./ai-text-model-picker";

function mockModel(
  canonicalId: string,
  groupId: string | null
): OrgTextModelOption {
  return {
    canonicalId,
    displayName: canonicalId,
    modality: "text",
    providerModelId: canonicalId,
    parameterRules: {},
    selectable: true,
    description: "",
    groupId,
    groupName: null,
    groupDescription: null,
    groupIcon: null,
  };
}

const groups: readonly PlatformAiModelGroup[] = [
  {
    id: "claude",
    name: "Claude",
    description: "Complex reasoning",
    icon: "sparkles",
    sortOrder: 1,
  },
  {
    id: "seed",
    name: "Seed",
    description: "Chinese tasks",
    icon: "zap",
    sortOrder: 2,
  },
];

describe("ai-text-model-picker", () => {
  it("builds brand sections from groups and buckets ungrouped models", () => {
    const sections = buildModelBrandSections({
      models: [
        mockModel("claude-sonnet", "claude"),
        mockModel("claude-opus", "claude"),
        mockModel("seed-1", "seed"),
        mockModel("solo", null),
      ],
      groups,
      otherGroupLabel: "Other",
    });

    expect(sections).toHaveLength(3);
    expect(sections[0]?.id).toBe("claude");
    expect(sections[0]?.models).toHaveLength(2);
    expect(sections[1]?.description).toBe("Chinese tasks");
    expect(sections[2]?.name).toBe("Other");
    expect(sections[2]?.models).toHaveLength(1);
  });

  it("resolves the active brand from the selected model", () => {
    const sections = buildModelBrandSections({
      models: [
        mockModel("claude-sonnet", "claude"),
        mockModel("seed-1", "seed"),
      ],
      groups,
      otherGroupLabel: "Other",
    });

    expect(
      resolveActiveBrandId({
        selectedModel: mockModel("seed-1", "seed"),
        sections,
      })
    ).toBe("seed");
  });

  it("prefers floating model list above and falls back below", () => {
    expect(
      resolveBrandFlyoutPlacement({
        spaceAbove: 200,
        spaceBelow: 40,
        flyoutHeight: 120,
      })
    ).toBe("above");

    expect(
      resolveBrandFlyoutPlacement({
        spaceAbove: 40,
        spaceBelow: 200,
        flyoutHeight: 120,
      })
    ).toBe("below");
  });
});
