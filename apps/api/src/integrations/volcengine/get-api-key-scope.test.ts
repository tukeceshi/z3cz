import { describe, expect, it } from "vitest";

import type { VolcanoInterfaceMetadata } from "@dafthunk/types";

import { volcanoNeedsModelScopedArkKey } from "./get-api-key";

function baseMetadata(
  patch: Partial<VolcanoInterfaceMetadata>
): VolcanoInterfaceMetadata {
  return {
    credentialMode: "volcengine_iam",
    accessKeyId: "AKLT",
    secretAccessKeyEncrypted: "enc",
    arkApiKeyDurationSeconds: 3600,
    region: "cn-beijing",
    models: {},
    ...patch,
  };
}

describe("volcanoNeedsModelScopedArkKey", () => {
  it("is true when an enabled model has no endpoint (Seed)", () => {
    expect(
      volcanoNeedsModelScopedArkKey(
        baseMetadata({
          arkApiKeyScope: "endpoint",
          arkEndpoints: {
            "deepseek-v4-flash": "ep-flash",
          },
          models: {
            "deepseek-v4-flash": {
              canonicalId: "deepseek-v4-flash",
              enabled: true,
              upstreamModelId: "deepseek-v4-flash-260425",
              modality: "text",
            },
            "doubao-seed-evolving": {
              canonicalId: "doubao-seed-evolving",
              enabled: true,
              upstreamModelId: "doubao-seed-evolving",
              modality: "text",
            },
          },
        })
      )
    ).toBe(true);
  });

  it("is false when every enabled model has an endpoint", () => {
    expect(
      volcanoNeedsModelScopedArkKey(
        baseMetadata({
          arkEndpoints: {
            "deepseek-v4-flash": "ep-flash",
          },
          models: {
            "deepseek-v4-flash": {
              canonicalId: "deepseek-v4-flash",
              enabled: true,
              upstreamModelId: "deepseek-v4-flash-260425",
              modality: "text",
            },
            "doubao-seed-evolving": {
              canonicalId: "doubao-seed-evolving",
              enabled: false,
              upstreamModelId: "doubao-seed-evolving",
              modality: "text",
            },
          },
        })
      )
    ).toBe(false);
  });
});
