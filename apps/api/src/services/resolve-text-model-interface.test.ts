import { describe, expect, it, vi } from "vitest";

import {
  ensureVolcanoModelsIncludePlatformCatalog,
  resolveOrgModelInterfaceBinding,
  toVolcanoCatalogEntriesFromPlatform,
} from "./resolve-text-model-interface";
import type {
  PlatformAiModel,
  PlatformAiModelParameterRules,
  VolcanoInterfaceMetadata,
} from "@dafthunk/types";
import { DEFAULT_TEXT_MODEL_PARAMETER_RULES } from "@dafthunk/types";

const testTextRules =
  DEFAULT_TEXT_MODEL_PARAMETER_RULES as PlatformAiModelParameterRules;

describe("toVolcanoCatalogEntriesFromPlatform", () => {
  it("maps platform models using static volcano catalog providerModelIds", () => {
    const models: readonly PlatformAiModel[] = [
      {
        canonicalId: "deepseek-v4-flash",
        displayName: "DeepSeek V4 Flash",
        modality: "text",
        platformEnabled: true,
        sortOrder: 0,
        groupId: null,
        description: "",
        parameterRules: testTextRules,
      },
    ];

    expect(toVolcanoCatalogEntriesFromPlatform(models)).toEqual([
      {
        canonicalId: "deepseek-v4-flash",
        alias: "DeepSeek V4 Flash",
        modality: "text",
        providerModelId: "deepseek-v4-flash-260425",
      },
    ]);
  });

  it("excludes Moonshot brand-only platform models from volcano catalog", () => {
    const models: readonly PlatformAiModel[] = [
      {
        canonicalId: "kimi-k3",
        displayName: "Kimi K3",
        modality: "text",
        platformEnabled: true,
        sortOrder: 41,
        groupId: null,
        description: "",
        parameterRules: testTextRules,
      },
      {
        canonicalId: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
        modality: "text",
        platformEnabled: true,
        sortOrder: 0,
        groupId: null,
        description: "",
        parameterRules: testTextRules,
      },
    ];

    expect(toVolcanoCatalogEntriesFromPlatform(models)).toEqual([
      {
        canonicalId: "deepseek-v4-pro",
        alias: "DeepSeek V4 Pro",
        modality: "text",
        providerModelId: "deepseek-v4-pro-260425",
      },
    ]);
  });
});

describe("resolveOrgModelInterfaceBinding", () => {
  it("resolves using modality-specific options without requiring text catalog membership", async () => {
    const candidateSpy = vi
      .spyOn(
        await import("./resolve-text-model-interface"),
        "resolveOrgModelInterfaceCandidate"
      )
      .mockResolvedValue({
        interfaceId: "iface-1",
        interfaceName: "Volcano",
        channelKind: "aggregate",
        providerModelId: "seedream-id",
      });

    const db = {} as import("../db").Database;
    const listOptions = vi.fn(async () => [
      {
        canonicalId: "doubao-seedream-5",
        interfaceId: "iface-1",
        selectable: true,
        displayName: "[聚合] Seedream 5",
        parameterRules: { promptMaxChars: 2000 },
      },
    ]);

    const resolved = await resolveOrgModelInterfaceBinding(
      db,
      "org-1",
      "doubao-seedream-5",
      "iface-1",
      listOptions
    );

    expect(resolved).toEqual({
      canonicalId: "doubao-seedream-5",
      displayName: "[聚合] Seedream 5",
      interfaceId: "iface-1",
      interfaceName: "Volcano",
      providerModelId: "seedream-id",
      parameterRules: { promptMaxChars: 2000 },
    });
    expect(listOptions).toHaveBeenCalledWith(db, "org-1");
    candidateSpy.mockRestore();
  });

  it("returns null when binding is not selectable", async () => {
    const candidateSpy = vi
      .spyOn(
        await import("./resolve-text-model-interface"),
        "resolveOrgModelInterfaceCandidate"
      )
      .mockResolvedValue({
        interfaceId: "iface-1",
        interfaceName: "Volcano",
        channelKind: "aggregate",
        providerModelId: "seedream-id",
      });

    const db = {} as import("../db").Database;
    const listOptions = vi.fn(async () => [
      {
        canonicalId: "doubao-seedream-5",
        interfaceId: "iface-1",
        selectable: false,
        displayName: "[聚合] Seedream 5",
        parameterRules: { promptMaxChars: 2000 },
      },
    ]);

    const resolved = await resolveOrgModelInterfaceBinding(
      db,
      "org-1",
      "doubao-seedream-5",
      "iface-1",
      listOptions
    );

    expect(resolved).toBeNull();
    candidateSpy.mockRestore();
  });
});

describe("ensureVolcanoModelsIncludePlatformCatalog", () => {
  it("adds missing catalog keys with enabled=false", () => {
    const metadata: VolcanoInterfaceMetadata = {
      credentialMode: "volcengine_iam",
      accessKeyId: "ak",
      secretAccessKeyEncrypted: "enc",
      arkApiKeyDurationSeconds: 3600,
      region: "cn-beijing",
      models: {
        "deepseek-v4-pro": {
          enabled: true,
          providerModelId: "deepseek-v4-pro-260425",
          modality: "text",
        },
      },
    };

    const next = ensureVolcanoModelsIncludePlatformCatalog(metadata, [
      {
        canonicalId: "deepseek-v4-flash",
        alias: "DeepSeek V4 Flash",
        modality: "text",
        providerModelId: "deepseek-v4-flash-260425",
      },
      {
        canonicalId: "deepseek-v4-pro",
        alias: "DeepSeek V4 Pro",
        modality: "text",
        providerModelId: "deepseek-v4-pro-260425",
      },
    ]);

    expect(next.models["deepseek-v4-pro"]?.enabled).toBe(true);
    expect(next.models["deepseek-v4-flash"]).toEqual({
      enabled: false,
      providerModelId: "deepseek-v4-flash-260425",
      modality: "text",
    });
  });

  it("does not overwrite existing providerModelId", () => {
    const metadata: VolcanoInterfaceMetadata = {
      credentialMode: "volcengine_iam",
      accessKeyId: "ak",
      secretAccessKeyEncrypted: "enc",
      arkApiKeyDurationSeconds: 3600,
      region: "cn-beijing",
      models: {
        "glm-5-2": {
          enabled: true,
          providerModelId: "glm-5.2",
          modality: "text",
        },
      },
    };

    const next = ensureVolcanoModelsIncludePlatformCatalog(metadata, [
      {
        canonicalId: "glm-5-2",
        alias: "GLM-5.2",
        modality: "text",
        providerModelId: "glm-5-2-260617",
      },
    ]);

    expect(next.models["glm-5-2"]).toEqual({
      enabled: true,
      providerModelId: "glm-5.2",
      modality: "text",
    });
  });
});
