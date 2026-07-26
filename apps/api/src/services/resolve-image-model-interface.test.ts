import { describe, expect, it } from "vitest";

import { evaluateOrgTextModelAvailability } from "./resolve-text-model-interface";

describe("resolve-image-model-interface availability", () => {
  it("is selectable when a Seedream single-model interface enables the canonical id", () => {
    expect(
      evaluateOrgTextModelAvailability(
        "doubao-seedream-5",
        [],
        [
          {
            id: "iface-seedream",
            createdAt: new Date("2026-01-01"),
            singleModelPresetId: "provider:seedream",
            models: {
              "doubao-seedream-5": {
                enabled: true,
                upstreamModelId: "doubao-seedream-5-0-260128",
                modality: "image",
              },
            },
          },
        ]
      )
    ).toEqual({ selectable: true });
  });

  it("returns no_org_interface when no volcano or single-model interfaces", () => {
    expect(evaluateOrgTextModelAvailability("doubao-seedream-5", [])).toEqual({
      selectable: false,
      unavailableReason: "no_org_interface",
    });
  });
});
