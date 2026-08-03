import type {
  OrgTextModelOption,
  PlatformAiModelGroup,
} from "@dafthunk/types";
import { buildOrgModelOptionId } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  buildModelBrandSections,
  resolveActiveBrandId,
  resolveBrandFlyoutLayout,
} from "./ai-text-model-picker";

function mockModel(
  canonicalId: string,
  groupId: string | null,
  interfaceId = "iface-1"
): OrgTextModelOption {
  return {
    optionId: buildOrgModelOptionId(interfaceId, canonicalId),
    canonicalId,
    interfaceId,
    channelKind: "aggregate",
    alias: canonicalId,
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
    modality: "text",
    sortOrder: 1,
  },
  {
    id: "seed",
    name: "Seed",
    description: "Chinese tasks",
    icon: "zap",
    modality: "text",
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
    const seedModel = mockModel("seed-1", "seed");
    const sections = buildModelBrandSections({
      models: [
        mockModel("claude-sonnet", "claude"),
        seedModel,
      ],
      groups,
      otherGroupLabel: "Other",
    });

    expect(
      resolveActiveBrandId({
        selectedOptionId: seedModel.optionId,
        sections,
      })
    ).toBe("seed");
  });

  it("omits brands that only contain non-selectable models when filtered first", () => {
    const models = [
      mockModel("claude-sonnet", "claude"),
      { ...mockModel("seed-1", "seed"), selectable: false },
    ];
    const sections = buildModelBrandSections({
      models: models.filter((model) => model.selectable),
      groups,
      otherGroupLabel: "Other",
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe("claude");
  });

  it("positions flyout to the right of the anchor row", () => {
    const layout = resolveBrandFlyoutLayout({
      rowRect: { top: 100, left: 16, right: 336, width: 320 },
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(layout.left).toBe(342);
    expect(layout.top).toBe(100);
    expect(layout.width).toBe(240);
    expect(layout.maxHeight).toBe(280);
  });

  it("flips flyout to the left when right side has no space", () => {
    const layout = resolveBrandFlyoutLayout({
      rowRect: { top: 100, left: 16, right: 780, width: 320 },
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(layout.left).toBe(8);
    expect(layout.top).toBe(100);
  });
});
