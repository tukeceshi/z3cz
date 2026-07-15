import { describe, expect, it } from "vitest";
import type {
  AiModelCatalogEntry,
  VolcanoInterfaceMetadata,
} from "@dafthunk/types";

import {
  isVolcanoMetadata,
  mergeVolcanoActivationCache,
  parseInterfaceMetadata,
} from "./metadata";

const sample: VolcanoInterfaceMetadata = {
  credentialMode: "volcengine_iam",
  accessKeyId: "ak",
  secretAccessKeyEncrypted: "enc",
  arkApiKeyDurationSeconds: 3600,
  region: "cn-beijing",
  models: {
    "deepseek-v4-flash": {
      enabled: true,
      providerModelId: "deepseek-v4-flash-260425",
      modality: "text",
    },
  },
};

describe("parseInterfaceMetadata", () => {
  it("parses JSON strings", () => {
    const parsed = parseInterfaceMetadata(JSON.stringify(sample));
    expect(isVolcanoMetadata(parsed)).toBe(true);
    expect(parsed).toEqual(sample);
  });

  it("returns already-parsed objects without re-stringifying", () => {
    // Regression: listOrganizationAiInterfaces pre-parses metadata.
    // JSON.parse(object) becomes JSON.parse("[object Object]") → null.
    const parsed = parseInterfaceMetadata(sample);
    expect(parsed).toBe(sample);
    expect(isVolcanoMetadata(parsed)).toBe(true);
  });

  it("returns null for empty / invalid input", () => {
    expect(parseInterfaceMetadata(null)).toBeNull();
    expect(parseInterfaceMetadata(undefined)).toBeNull();
    expect(parseInterfaceMetadata("")).toBeNull();
    expect(parseInterfaceMetadata("{not-json")).toBeNull();
  });
});

describe("mergeVolcanoActivationCache", () => {
  it("keeps platform-only models when catalog entries are provided", () => {
    const platformOnly: AiModelCatalogEntry = {
      canonicalId: "platform-only-model",
      alias: "Platform Only",
      modality: "text",
      providerModelId: "platform-only-model-id",
    };
    const metadata: VolcanoInterfaceMetadata = {
      ...sample,
      models: {
        ...sample.models,
        [platformOnly.canonicalId]: {
          enabled: true,
          providerModelId: platformOnly.providerModelId,
          modality: "text",
        },
      },
    };

    const prunedWithoutCatalog = mergeVolcanoActivationCache(metadata, [
      {
        canonicalId: platformOnly.canonicalId,
        providerModelId: platformOnly.providerModelId,
        status: "open",
        errorCode: null,
        message: null,
        probedAt: new Date().toISOString(),
      },
    ]);
    expect(prunedWithoutCatalog.models[platformOnly.canonicalId]).toBeUndefined();

    const prunedWithCatalog = mergeVolcanoActivationCache(
      metadata,
      [
        {
          canonicalId: platformOnly.canonicalId,
          providerModelId: platformOnly.providerModelId,
          status: "open",
          errorCode: null,
          message: null,
          probedAt: new Date().toISOString(),
        },
      ],
      [platformOnly]
    );
    expect(prunedWithCatalog.models[platformOnly.canonicalId]?.enabled).toBe(
      true
    );
    expect(
      prunedWithCatalog.modelActivationCache?.[platformOnly.canonicalId]?.status
    ).toBe("open");
  });
});
