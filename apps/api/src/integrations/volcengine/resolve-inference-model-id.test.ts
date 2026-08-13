import { describe, expect, it, vi } from "vitest";

import { resolveVolcanoInferenceModelIdAfterEnsure } from "./resolve-inference-model-id";

vi.mock("../../db/ai-interface-queries", () => ({
  getOrganizationAiInterfaceRow: vi.fn(),
}));

import { getOrganizationAiInterfaceRow } from "../../db/ai-interface-queries";

describe("resolveVolcanoInferenceModelIdAfterEnsure", () => {
  it("uses endpoint id when metadata was updated after ensure", async () => {
    vi.mocked(getOrganizationAiInterfaceRow).mockResolvedValue({
      metadata: JSON.stringify({
        credentialMode: "volcengine_iam",
        accessKeyId: "ak",
        secretAccessKeyEncrypted: "enc",
        arkApiKeyDurationSeconds: 3600,
        region: "cn-beijing",
        arkApiKeyScope: "endpoint",
        arkEndpoints: { "glm-5-2": "ep-glm" },
        models: {
          "glm-5-2": {
            enabled: true,
            providerModelId: "glm-5-2-260617",
            modality: "text",
          },
        },
      }),
    } as never);

    const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
      db: {} as never,
      organizationId: "org-1",
      interfaceId: "iface-1",
      canonicalId: "glm-5-2",
    });

    expect(inferenceModelId).toBe("ep-glm");
  });

  it("reads providerModelId from volcano interface metadata", async () => {
    vi.mocked(getOrganizationAiInterfaceRow).mockResolvedValue({
      metadata: JSON.stringify({
        credentialMode: "volcengine_iam",
        accessKeyId: "ak",
        secretAccessKeyEncrypted: "enc",
        arkApiKeyDurationSeconds: 3600,
        region: "cn-beijing",
        models: {
          "glm-5-2": {
            enabled: true,
            providerModelId: "glm-5-2-260617",
            modality: "text",
          },
        },
      }),
    } as never);

    const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
      db: {} as never,
      organizationId: "org-1",
      interfaceId: "iface-1",
      canonicalId: "glm-5-2",
    });

    expect(inferenceModelId).toBe("glm-5-2-260617");
  });

  it("returns null when interface metadata has no upstream id", async () => {
    vi.mocked(getOrganizationAiInterfaceRow).mockResolvedValue({
      metadata: JSON.stringify({ provider: "openai" }),
    } as never);

    const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
      db: {} as never,
      organizationId: "org-1",
      interfaceId: "iface-1",
      canonicalId: "glm-5-2",
    });

    expect(inferenceModelId).toBeNull();
  });

  it("reads upstreamModelId from single-model instance map keyed by UUID", async () => {
    vi.mocked(getOrganizationAiInterfaceRow).mockResolvedValue({
      metadata: JSON.stringify({
        channel: "single-model",
        singleModelPresetId: "provider:newapi",
        models: {
          "550e8400-e29b-41d4-a716-446655440000": {
            canonicalId: "seedance-1.5-pro",
            enabled: true,
            upstreamModelId: "seedance-1-5-pro",
            modality: "video",
          },
        },
      }),
    } as never);

    const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
      db: {} as never,
      organizationId: "org-1",
      interfaceId: "iface-1",
      canonicalId: "seedance-1.5-pro",
    });

    expect(inferenceModelId).toBe("seedance-1-5-pro");
  });
});
