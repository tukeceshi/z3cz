import { describe, expect, it } from "vitest";

import { resolveVolcanoEffectiveActivationStatus } from "./volcano-effective-activation";

describe("resolveVolcanoEffectiveActivationStatus", () => {
  it("opens glm-5-2 when billing package is provisioned despite stale probe", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "glm-5-2",
        probe: {
          status: "not_open",
          probedAt: "2026-07-22T12:30:27.243Z",
          errorCode: null,
          message: null,
        },
        packageSnapshot: {
          provisioned: true,
          matchedCodes: ["GLM_5.2_free_inference_resource_pack"],
          instanceNos: ["rpi-1"],
          configurationNames: ["GLM-5.2-免费在线推理资源包"],
        },
      })
    ).toBe("open");
  });
});
