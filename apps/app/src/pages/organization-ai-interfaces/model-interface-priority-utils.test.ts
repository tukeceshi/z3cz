import { describe, expect, it } from "vitest";

import {
  buildDuplicateTextModelEntries,
  sortBrandInterfacesByPriority,
} from "./model-interface-priority-utils";

describe("model-interface-priority-utils", () => {
  it("lists only models enabled on two or more brands", () => {
    const entries = buildDuplicateTextModelEntries({
      models: [
        {
          canonicalId: "deepseek-v4-flash",
          displayName: "DeepSeek V4 Flash",
          modality: "text",
          providerModelId: "deepseek-v4-flash",
          parameterRules: {} as never,
          selectable: true,
          description: null,
          groupId: null,
          groupName: null,
          groupDescription: null,
          groupIcon: null,
        },
      ],
      interfaces: [
        {
          id: "volcano-1",
          organizationId: "org-1",
          name: "Volcano",
          provider: "doubao_volcano",
          enabled: true,
          isDefault: false,
          hasApiKey: true,
          metadata: {
            models: {
              "deepseek-v4-flash": { enabled: true, providerModelId: "x", modality: "text" },
            },
          },
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "deepseek-1",
          organizationId: "org-1",
          name: "DeepSeek",
          provider: "custom",
          enabled: true,
          isDefault: false,
          hasApiKey: true,
          metadata: {
            channel: "single-model",
            singleModelPresetId: "provider:deepseek",
            models: {
              "deepseek-v4-flash": {
                enabled: true,
                upstreamModelId: "deepseek-chat",
                modality: "text",
              },
            },
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      modalityLabelFor: () => "文字",
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.brandInterfaces).toHaveLength(2);
  });

  it("sorts brand interfaces by saved priority", () => {
    const sorted = sortBrandInterfacesByPriority(
      [
        {
          interfaceId: "a",
          interfaceName: "A",
          channelKind: "api",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          interfaceId: "b",
          interfaceName: "B",
          channelKind: "aggregate",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      ["b", "a"]
    );

    expect(sorted.map((entry) => entry.interfaceId)).toEqual(["b", "a"]);
  });
});
