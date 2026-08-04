import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformAiModel, PlatformAiModelParameterRules } from "@dafthunk/types";
import { DEFAULT_TEXT_MODEL_PARAMETER_RULES } from "@dafthunk/types";

const listPlatformAiModels = vi.fn();
const listPlatformAiModelGroups = vi.fn();

vi.mock("../db/platform-ai-model-queries", () => ({
  listPlatformAiModels,
  listPlatformAiModelGroups,
}));

import { listPlatformCatalogModelOptions } from "./list-platform-catalog-model-options";

const testTextRules =
  DEFAULT_TEXT_MODEL_PARAMETER_RULES as PlatformAiModelParameterRules;

describe("listPlatformCatalogModelOptions", () => {
  beforeEach(() => {
    listPlatformAiModels.mockReset();
    listPlatformAiModelGroups.mockReset();
  });

  it("returns all platform-enabled models without org interface bindings", async () => {
    const models: readonly PlatformAiModel[] = [
      {
        canonicalId: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
        modality: "text",
        platformEnabled: true,
        sortOrder: 0,
        groupId: "deepseek",
        description: "",
        parameterRules: testTextRules,
      },
      {
        canonicalId: "kimi-k3",
        displayName: "Kimi K3",
        modality: "text",
        platformEnabled: true,
        sortOrder: 1,
        groupId: null,
        description: "",
        parameterRules: testTextRules,
      },
      {
        canonicalId: "disabled-model",
        displayName: "Disabled",
        modality: "text",
        platformEnabled: false,
        sortOrder: 2,
        groupId: null,
        description: "",
        parameterRules: testTextRules,
      },
    ];

    listPlatformAiModels.mockResolvedValue(models);
    listPlatformAiModelGroups.mockResolvedValue([
      {
        id: "deepseek",
        name: "DeepSeek",
        description: "",
        icon: "sparkles",
        modality: "text",
        sortOrder: 0,
      },
    ]);

    const result = await listPlatformCatalogModelOptions({} as never, "text");

    expect(result).toEqual([
      {
        canonicalId: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
        modality: "text",
        description: "",
        groupId: "deepseek",
        groupName: "DeepSeek",
        groupDescription: "",
        groupIcon: "sparkles",
      },
      {
        canonicalId: "kimi-k3",
        displayName: "Kimi K3",
        modality: "text",
        description: "",
        groupId: null,
        groupName: null,
        groupDescription: null,
        groupIcon: null,
      },
    ]);
  });
});
