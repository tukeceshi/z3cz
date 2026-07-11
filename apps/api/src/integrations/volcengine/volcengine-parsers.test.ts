import { describe, expect, it } from "vitest";

import {
  buildVolcanoPackageSnapshotForModel,
  buildVolcanoPackageUsageMap,
} from "./aggregate-package-usage";
import { readApiKeyId, readApiKeyIdValue } from "./get-api-key";
import {
  extractVolcanoListItems,
  readEndpointId,
} from "./list-endpoints";
import { formatVolcanoUsageDate } from "./get-inference-usage";
import {
  indexResourcePackagesByConfigurationCode,
  parsePackageAmount,
  type VolcanoResourcePackageRow,
} from "./parse-resource-packages";
import { resolveVolcanoEffectiveActivationStatus } from "./resolve-volcano-activation";
import { volcengineUriEscape } from "./signature";

describe("volcengineUriEscape", () => {
  it("matches Volcengine query escaping rules", () => {
    expect(volcengineUriEscape("2024-01-01")).toBe("2024-01-01");
    expect(volcengineUriEscape("a b")).toBe("a%20b");
  });
});

describe("parseResourcePackages", () => {
  it("parses numeric package amounts", () => {
    expect(parsePackageAmount("499940")).toBe(499940);
    expect(parsePackageAmount(undefined)).toBe(0);
    expect(parsePackageAmount("invalid")).toBe(0);
  });

  it("indexes rows by configuration code", () => {
    const rows: VolcanoResourcePackageRow[] = [
      { ConfigurationCode: "code-a", TotalAmount: "100" },
      { ConfigurationCode: "code-a", TotalAmount: "50" },
      { ConfigurationCode: "code-b", TotalAmount: "10" },
    ];
    const index = indexResourcePackagesByConfigurationCode(rows);
    expect(index.get("code-a")).toHaveLength(2);
    expect(index.get("code-b")).toHaveLength(1);
  });
});

describe("aggregatePackageUsage", () => {
  const seedanceRow: VolcanoResourcePackageRow = {
    ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
    ConfigurationName: "Doubao-Seedance-2.0免费在线推理资源包",
    TotalAmount: "2262252",
    AvailableAmount: "2174952",
    Unit: "token",
    Status: "Effective",
    InstanceNo: "rpi-1",
  };

  const seedanceRenewalRow: VolcanoResourcePackageRow = {
    ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
    ConfigurationName: "Doubao-Seedance-2.0免费在线推理资源包",
    TotalAmount: "1000000",
    AvailableAmount: "500000",
    Unit: "token",
    Status: "Effective",
    InstanceNo: "rpi-2",
  };

  const seedreamRow: VolcanoResourcePackageRow = {
    ConfigurationCode: "Doubao_Seedream_5.0_pack_free_infer",
    ConfigurationName: "Seedream-5.0-Lite",
    TotalAmount: "50",
    AvailableAmount: "50",
    Unit: "张",
    Status: "Effective",
    InstanceNo: "rpi-3",
  };

  it("aggregates Effective and UsedUp packages for total usage", () => {
    const seedanceEffective: VolcanoResourcePackageRow = {
      ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
      ConfigurationName: "Doubao-Seedance-2.0免费在线推理资源包",
      TotalAmount: "2262252",
      AvailableAmount: "2174952",
      Unit: "token",
      Status: "Effective",
      InstanceNo: "rpi-effective",
    };
    const seedanceUsedUp: VolcanoResourcePackageRow = {
      ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
      ConfigurationName: "Doubao-Seedance-2.0免费在线推理资源包",
      TotalAmount: "2737748",
      AvailableAmount: "0",
      Unit: "token",
      Status: "UsedUp",
      InstanceNo: "rpi-used-up",
    };

    const packagesByCode = indexResourcePackagesByConfigurationCode([
      seedanceEffective,
      seedanceUsedUp,
    ]);

    const map = buildVolcanoPackageUsageMap({
      catalog: [
        {
          canonicalId: "doubao-seedance-2",
          alias: "Seedance 2.0",
          modality: "video",
          providerModelId: "doubao-seedance-2-0-260128",
        },
      ],
      packagesByCode,
    });

    const usage = map.usageByCanonicalId.get("doubao-seedance-2");
    expect(usage?.quota).toBe(5_000_000);
    expect(usage?.remaining).toBe(2_174_952);
    expect(usage?.used).toBe(2_825_048);
    expect(usage?.expired).toBe(0);
    expect(usage?.usagePercent).toBe(43);
  });

  it("aggregates multiple effective packages for one model", () => {
    const packagesByCode = indexResourcePackagesByConfigurationCode([
      seedanceRow,
      seedanceRenewalRow,
    ]);

    const snapshot = buildVolcanoPackageSnapshotForModel({
      canonicalId: "doubao-seedance-2",
      packagesByCode,
    });

    expect(snapshot.provisioned).toBe(true);
    expect(snapshot.matchedCodes).toEqual(["Doubao_Seedance_2.0_pack_free_infer"]);
    expect(snapshot.instanceNos).toEqual(["rpi-1", "rpi-2"]);

    const map = buildVolcanoPackageUsageMap({
      catalog: [
        {
          canonicalId: "doubao-seedance-2",
          alias: "Seedance 2.0",
          modality: "video",
          providerModelId: "doubao-seedance-2-0-260128",
        },
      ],
      packagesByCode,
    });

    const usage = map.usageByCanonicalId.get("doubao-seedance-2");
    expect(usage?.quota).toBe(3_262_252);
    expect(usage?.remaining).toBe(2_674_952);
    expect(usage?.used).toBe(587_300);
    expect(usage?.expired).toBe(0);
    expect(usage?.unit).toBe("tokens");
    expect(usage?.usagePercent).toBe(82);
  });

  it("maps image package units to images", () => {
    const packagesByCode = indexResourcePackagesByConfigurationCode([seedreamRow]);
    const map = buildVolcanoPackageUsageMap({
      catalog: [
        {
          canonicalId: "doubao-seedream-5",
          alias: "Seedream 5.0",
          modality: "image",
          providerModelId: "doubao-seedream-5-0-260128",
        },
      ],
      packagesByCode,
    });

    const usage = map.usageByCanonicalId.get("doubao-seedream-5");
    expect(usage?.unit).toBe("images");
    expect(usage?.remaining).toBe(50);
  });

  it("marks mapped models without packages as not provisioned", () => {
    const packagesByCode = indexResourcePackagesByConfigurationCode([]);
    const snapshot = buildVolcanoPackageSnapshotForModel({
      canonicalId: "doubao-seedance-2-mini",
      packagesByCode,
    });

    expect(snapshot.provisioned).toBe(false);
    expect(
      buildVolcanoPackageUsageMap({
        catalog: [
          {
            canonicalId: "doubao-seedance-2-mini",
            alias: "Seedance 2.0 mini",
            modality: "video",
            providerModelId: "doubao-seedance-2-0-mini-260615",
          },
        ],
        packagesByCode,
      }).usageByCanonicalId.get("doubao-seedance-2-mini")
    ).toBeNull();
  });
});

describe("resolveVolcanoActivation", () => {
  it("prefers probe not_open over package provisioned", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "doubao-seedance-2",
        probe: {
          status: "not_open",
          probedAt: "2026-07-11T00:00:00.000Z",
          errorCode: "ModelNotOpen",
          message: null,
        },
        packageSnapshot: {
          provisioned: true,
          matchedCodes: ["Doubao_Seedance_2.0_pack_free_infer"],
          instanceNos: ["rpi-1"],
          configurationNames: ["pkg"],
        },
      })
    ).toBe("not_open");
  });

  it("infers not_open from missing package when probe has not run", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "doubao-seedance-2-mini",
        probe: null,
        packageSnapshot: {
          provisioned: false,
          matchedCodes: [],
          instanceNos: [],
          configurationNames: [],
        },
      })
    ).toBe("not_open");
  });

  it("does not infer not_open for models without package mapping", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "doubao-seed-evolving",
        probe: null,
        packageSnapshot: {
          provisioned: false,
          matchedCodes: [],
          instanceNos: [],
          configurationNames: [],
        },
      })
    ).toBeNull();
  });

  it("does not infer not_open for optional models without package when probe has not run", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "doubao-seedream-5-pro",
        probe: null,
        packageSnapshot: {
          provisioned: false,
          matchedCodes: [],
          instanceNos: [],
          configurationNames: [],
        },
      })
    ).toBe("unknown");
  });

  it("returns unknown for required models with package but no probe", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "doubao-seedream-5",
        probe: null,
        packageSnapshot: {
          provisioned: true,
          matchedCodes: ["Doubao_Seedream_5.0_pack_free_infer"],
          instanceNos: ["rpi-1"],
          configurationNames: ["pkg"],
        },
      })
    ).toBe("unknown");
  });
});

describe("volcengine list parsers", () => {
  it("formats usage dates as yyyy-mm-dd", () => {
    expect(formatVolcanoUsageDate(new Date("2026-07-11T12:34:56.000Z"))).toBe(
      "2026-07-11"
    );
  });

  it("reads endpoint and api key ids from Ark list items", () => {
    expect(readEndpointId({ Id: "ep-123" })).toBe("ep-123");
    expect(readApiKeyId({ Id: "key-123", Name: "default" })).toBe("key-123");
    expect(readApiKeyId({ Id: 2348682, Name: "default" })).toBe("2348682");
    expect(readApiKeyIdValue({ Id: 2348682 })).toBe(2348682);
    expect(readApiKeyId("key-456")).toBe("key-456");
  });

  it("extracts list items from multiple response shapes", () => {
    expect(
      extractVolcanoListItems({
        Items: [{ Id: "a" }],
      })
    ).toHaveLength(1);

    expect(
      extractVolcanoListItems({
        ApiKeys: [{ Id: "b" }],
      })
    ).toHaveLength(1);
  });
});
