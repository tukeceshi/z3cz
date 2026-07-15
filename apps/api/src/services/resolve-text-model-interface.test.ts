import { describe, expect, it } from "vitest";

import {
  ensureVolcanoModelsIncludePlatformCatalog,
  evaluateOrgTextModelAvailability,
  toVolcanoCatalogEntriesFromPlatform,
} from "./resolve-text-model-interface";
import type { PlatformAiModel, VolcanoInterfaceMetadata } from "@dafthunk/types";

describe("evaluateOrgTextModelAvailability", () => {
  it("returns no_org_interface when no volcano interfaces", () => {
    expect(evaluateOrgTextModelAvailability("deepseek-v4-flash", [])).toEqual({
      selectable: false,
      unavailableReason: "no_org_interface",
    });
  });

  it("is selectable when any interface enables the model", () => {
    expect(
      evaluateOrgTextModelAvailability("deepseek-v4-flash", [
        {
          id: "a",
          createdAt: new Date("2026-01-01"),
          models: {
            "deepseek-v4-flash": {
              enabled: false,
              providerModelId: "deepseek-v4-flash-260425",
              modality: "text",
            },
          },
        },
        {
          id: "b",
          createdAt: new Date("2026-02-01"),
          models: {
            "deepseek-v4-flash": {
              enabled: true,
              providerModelId: "deepseek-v4-flash-260425",
              modality: "text",
            },
          },
        },
      ])
    ).toEqual({ selectable: true });
  });

  it("returns model_disabled_on_interface when key exists but off", () => {
    expect(
      evaluateOrgTextModelAvailability("deepseek-v4-flash", [
        {
          id: "a",
          createdAt: new Date("2026-01-01"),
          models: {
            "deepseek-v4-flash": {
              enabled: false,
              providerModelId: "deepseek-v4-flash-260425",
              modality: "text",
            },
          },
        },
      ])
    ).toEqual({
      selectable: false,
      unavailableReason: "model_disabled_on_interface",
    });
  });

  it("returns model_missing_on_interface when key absent", () => {
    expect(
      evaluateOrgTextModelAvailability("deepseek-v4-flash", [
        {
          id: "a",
          createdAt: new Date("2026-01-01"),
          models: {
            "deepseek-v4-pro": {
              enabled: true,
              providerModelId: "deepseek-v4-pro-260425",
              modality: "text",
            },
          },
        },
      ])
    ).toEqual({
      selectable: false,
      unavailableReason: "model_missing_on_interface",
    });
  });
});

describe("toVolcanoCatalogEntriesFromPlatform", () => {
  it("maps platform models to volcano catalog entries", () => {
    const models: readonly PlatformAiModel[] = [
      {
        canonicalId: "deepseek-v4-flash",
        displayName: "DeepSeek V4 Flash",
        modality: "text",
        providerModelId: "deepseek-v4-flash-260425",
        platformEnabled: true,
        sortOrder: 0,
        parameterRules: {
          schemaVersion: 1,
          referenceInputs: [{ type: "string", field: "keywords", maxCount: 1 }],
          keywordsMaxChars: 2000,
          promptMaxChars: 8000,
          outputMaxTokens: 4096,
          outputMaxTokensLimit: 8192,
          outputMaxChars: 20000,
          contextWindowTokens: 128000,
        },
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
});
