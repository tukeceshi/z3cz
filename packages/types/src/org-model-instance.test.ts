import { describe, expect, it } from "vitest";

import {
  findEnabledOrgModelInstanceByCanonicalId,
  findOrgModelInstanceEntry,
  listOrgModelEntries,
  normalizeOrgModelInstanceConfig,
} from "./org-model-instance";

describe("org-model-instance", () => {
  it("normalizes legacy volcano providerModelId on read", () => {
    const config = normalizeOrgModelInstanceConfig("deepseek-v4-flash", {
      enabled: true,
      providerModelId: "deepseek-v4-flash-260425",
      modality: "text",
    });

    expect(config).toEqual({
      canonicalId: "deepseek-v4-flash",
      enabled: true,
      upstreamModelId: "deepseek-v4-flash-260425",
      modality: "text",
    });
  });

  it("finds single-model instance by canonicalId when map key is UUID", () => {
    const entry = normalizeOrgModelInstanceConfig("inst-1", {
      canonicalId: "seedance-1.5-pro",
      enabled: true,
      upstreamModelId: "seedance-1-5-pro",
      modality: "video",
    });
    expect(entry).not.toBeNull();

    expect(
      findOrgModelInstanceEntry([{ instanceId: "inst-1", canonicalId: entry!.canonicalId, config: entry! }], {
        canonicalId: "seedance-1.5-pro",
        enabledOnly: true,
      })
    ).toEqual({
      instanceId: "inst-1",
      canonicalId: "seedance-1.5-pro",
      config: entry,
    });
  });

  it("lists volcano models as unified entries", () => {
    const entries = listOrgModelEntries({
      "glm-5-2": {
        enabled: true,
        upstreamModelId: "glm-5-2-260617",
        canonicalId: "glm-5-2",
        modality: "text",
      },
    });

    expect(findEnabledOrgModelInstanceByCanonicalId(entries, "glm-5-2")).toEqual(
      entries[0]
    );
  });
});
