import { describe, expect, it } from "vitest";

import {
  collectVolcanoArkEndpointIds,
  normalizeVolcanoArkEndpoints,
  resolveVolcanoInferenceModelId,
} from "./volcano-ark-access";
import type { VolcanoInterfaceMetadata } from "./volcano-snapshot";

const baseMetadata = {
  credentialMode: "volcengine_iam",
  accessKeyId: "ak",
  secretAccessKeyEncrypted: "enc",
  arkApiKeyDurationSeconds: 3600,
  region: "cn-beijing",
} as const satisfies Partial<VolcanoInterfaceMetadata>;

describe("resolveVolcanoInferenceModelId", () => {
  it("uses provider ModelId for model-scoped keys", () => {
    expect(
      resolveVolcanoInferenceModelId({
        canonicalId: "deepseek-v4-flash",
        providerModelId: "deepseek-v4-flash-260425",
        metadata: { arkApiKeyScope: "model" },
      })
    ).toBe("deepseek-v4-flash-260425");
  });

  it("uses endpoint id for endpoint-scoped keys when mapped", () => {
    expect(
      resolveVolcanoInferenceModelId({
        canonicalId: "glm-5-2",
        providerModelId: "glm-5-2-260617",
        metadata: {
          arkApiKeyScope: "endpoint",
          arkEndpoints: { "glm-5-2": "ep-glm" },
        },
      })
    ).toBe("ep-glm");
  });

  it("falls back to provider ModelId when endpoint mapping is missing", () => {
    expect(
      resolveVolcanoInferenceModelId({
        canonicalId: "glm-5-2",
        providerModelId: "glm-5-2-260617",
        metadata: { arkApiKeyScope: "endpoint", arkEndpoints: {} },
      })
    ).toBe("glm-5-2-260617");
  });
});

describe("collectVolcanoArkEndpointIds", () => {
  it("deduplicates endpoint ids", () => {
    expect(
      collectVolcanoArkEndpointIds({
        arkEndpoints: {
          "glm-5-2": "ep-1",
          "deepseek-v4-flash": "ep-1",
        },
      })
    ).toEqual(["ep-1"]);
  });
});

describe("normalizeVolcanoArkEndpoints", () => {
  it("migrates legacy model.endpointId to arkEndpoints", () => {
    const metadata = {
      ...baseMetadata,
      models: {
        "glm-5-2": {
          enabled: true,
          providerModelId: "glm-5-2-260617",
          modality: "text",
          endpointId: "ep-legacy",
        },
      },
    } as unknown as VolcanoInterfaceMetadata;

    const normalized = normalizeVolcanoArkEndpoints(metadata);
    expect(normalized.arkEndpoints).toEqual({ "glm-5-2": "ep-legacy" });
  });
});
