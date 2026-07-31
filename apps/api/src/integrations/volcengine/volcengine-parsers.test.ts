import { describe, expect, it } from "vitest";
import {
  aggregateResourcePackageRows,
  computeUsageBarSegments,
  mergeVolcanoResourcePackagesByInstance,
  parseVolcanoPackageAmount,
  pickVolcanoPackageOwnerCanonicalId,
  volcanoPackageMatchKeyForCanonicalId,
  volcanoPackageProvisionModeForCanonicalId,
} from "@dafthunk/types";

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
  type VolcanoResourcePackageRow,
} from "./parse-resource-packages";
import {
  buildVolcanoProbeResultsFromPackages,
  enrichVolcanoProbeResultsWithPackages,
  normalizeVolcanoWizardProbeResults,
  resolveVolcanoEffectiveActivationStatus,
} from "./resolve-volcano-activation";
import { pruneVolcanoMetadataToCatalog } from "./metadata";
import { volcengineUriEscape } from "./signature";

describe("volcengineUriEscape", () => {
  it("matches Volcengine query escaping rules", () => {
    expect(volcengineUriEscape("2024-01-01")).toBe("2024-01-01");
    expect(volcengineUriEscape("a b")).toBe("a%20b");
  });
});

describe("parseResourcePackages", () => {
  it("parses numeric package amounts", () => {
    expect(parseVolcanoPackageAmount("499940")).toBe(499940);
    expect(parseVolcanoPackageAmount(undefined)).toBe(0);
    expect(parseVolcanoPackageAmount("invalid")).toBe(0);
  });

  it("maps package match keys from model ids with three exceptions", () => {
    expect(volcanoPackageMatchKeyForCanonicalId("doubao-seed-evolving")).toBe(
      "doubao_seed_evolving"
    );
    expect(volcanoPackageMatchKeyForCanonicalId("deepseek-v4-pro")).toBe(
      "deepseek_v4_pro"
    );
    expect(volcanoPackageMatchKeyForCanonicalId("glm-5-2")).toBe("glm_5.2");
    expect(
      volcanoPackageMatchKeyForCanonicalId("doubao-seedance-2-fast")
    ).toBe("doubao_seedance_2.0_fast");
    expect(
      volcanoPackageMatchKeyForCanonicalId("doubao-seedance-2-mini")
    ).toBe("doubao_seedance_2.0_mini");
    expect(
      volcanoPackageProvisionModeForCanonicalId("doubao-seed-evolving")
    ).toBe("required");
  });

  it("gives fast Seedance packages to the fast model via longest key", () => {
    expect(
      pickVolcanoPackageOwnerCanonicalId(
        "Doubao_Seedance_2.0_fast_pack_free_infer",
        [
          "doubao-seedance-2",
          "doubao-seedance-2-fast",
          "doubao-seedance-2-mini",
        ]
      )
    ).toBe("doubao-seedance-2-fast");
    expect(
      pickVolcanoPackageOwnerCanonicalId("Doubao_Seedance_2.0_pack_free_infer", [
        "doubao-seedance-2",
        "doubao-seedance-2-fast",
        "doubao-seedance-2-mini",
      ])
    ).toBe("doubao-seedance-2");
  });

  it("aggregates Seed Evolving free and collaboration packages", () => {
    const packagesByCode = indexResourcePackagesByConfigurationCode([
      {
        ConfigurationCode: "Doubao_Seed_Evolving_free_infer_res_pack",
        ConfigurationName: "Doubao-Seed-Evolving免费在线推理资源包",
        TotalAmount: "500000",
        AvailableAmount: "498274",
        Unit: "token",
        Status: "Effective",
        InstanceNo: "rpi-free",
      },
      {
        ConfigurationCode: "Doubao_Seed_Evolving_pack_data_collaboration",
        ConfigurationName: "Doubao-Seed-Evolving协作奖励计划资源包",
        TotalAmount: "5000000",
        AvailableAmount: "5000000",
        Unit: "token",
        Status: "Effective",
        InstanceNo: "rpi-collab",
      },
    ]);

    const snapshot = buildVolcanoPackageSnapshotForModel({
      canonicalId: "doubao-seed-evolving",
      packagesByCode,
    });
    expect(snapshot.provisioned).toBe(true);
    expect(snapshot.matchedCodes).toEqual([
      "Doubao_Seed_Evolving_free_infer_res_pack",
      "Doubao_Seed_Evolving_pack_data_collaboration",
    ]);

    const { usageByCanonicalId } = buildVolcanoPackageUsageMap({
      catalog: [
        {
          canonicalId: "doubao-seed-evolving",
          alias: "Doubao Seed Evolving",
          modality: "text",
          providerModelId: "doubao-seed-evolving",
        },
      ],
      packagesByCode,
    });
    expect(usageByCanonicalId.get("doubao-seed-evolving")).toMatchObject({
      period: "package",
      quota: 5_500_000,
      remaining: 5_498_274,
      used: 1_726,
      unit: "tokens",
    });
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

  it("marks provisioned when only UsedUp packages exist", () => {
    const seedanceUsedUp: VolcanoResourcePackageRow = {
      ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
      ConfigurationName: "Doubao-Seedance-2.0免费在线推理资源包",
      TotalAmount: "2737748",
      AvailableAmount: "0",
      Unit: "token",
      Status: "UsedUp",
      InstanceNo: "rpi-used-up-only",
    };

    const packagesByCode = indexResourcePackagesByConfigurationCode([
      seedanceUsedUp,
    ]);

    const snapshot = buildVolcanoPackageSnapshotForModel({
      canonicalId: "doubao-seedance-2",
      packagesByCode,
    });

    expect(snapshot.provisioned).toBe(true);
    expect(snapshot.instanceNos).toEqual(["rpi-used-up-only"]);
  });

  it("exposes package status breakdown for Effective, UsedUp, and Expired", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        TotalAmount: "1000000",
        AvailableAmount: "400000",
        Unit: "token",
        Status: "Effective",
      },
      {
        TotalAmount: "500000",
        AvailableAmount: "0",
        Unit: "token",
        Status: "UsedUp",
      },
      {
        TotalAmount: "300000",
        AvailableAmount: "100000",
        Unit: "token",
        Status: "Expired",
      },
    ]);

    expect(usage?.packageStatus).toEqual({
      effectiveCount: 1,
      usedUpCount: 1,
      expiredCount: 1,
      effectiveRemaining: 400_000,
      usedUpConsumed: 500_000,
      expiredUnused: 100_000,
    });
  });

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

  it("aggregates a single Effective package from live probe shape", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
        TotalAmount: "2262252",
        AvailableAmount: "2174952",
        Unit: "token",
        Status: "Effective",
        InstanceNo: "rpi-20260411135215-fqzrq",
      },
    ]);

    expect(usage?.quota).toBe(2_262_252);
    expect(usage?.remaining).toBe(2_174_952);
    expect(usage?.used).toBe(87_300);
    expect(usage?.expired).toBe(0);
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

  it("aggregates expired unused into expired and includes total in quota", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
        TotalAmount: "1000000",
        AvailableAmount: "200000",
        Unit: "token",
        Status: "Expired",
        InstanceNo: "rpi-expired",
      },
    ]);

    expect(usage?.quota).toBe(1_000_000);
    expect(usage?.expired).toBe(200_000);
    expect(usage?.used).toBe(800_000);
    expect(usage?.remaining).toBe(0);
  });

  it("aggregates Effective, UsedUp, and Expired with quota identity", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        TotalAmount: "1000000",
        AvailableAmount: "400000",
        Unit: "token",
        Status: "Effective",
      },
      {
        TotalAmount: "500000",
        AvailableAmount: "0",
        Unit: "token",
        Status: "UsedUp",
      },
      {
        TotalAmount: "300000",
        AvailableAmount: "100000",
        Unit: "token",
        Status: "Expired",
      },
    ]);

    expect(usage?.quota).toBe(1_800_000);
    expect(usage?.remaining).toBe(400_000);
    expect(usage?.expired).toBe(100_000);
    expect(usage?.used).toBe(1_300_000);
    expect(usage?.remaining! + usage!.expired + usage!.used).toBe(usage?.quota);
  });

  it("counts entire UsedUp total as used when AvailableAmount remains", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        TotalAmount: "500000",
        AvailableAmount: "50000",
        Unit: "token",
        Status: "UsedUp",
      },
    ]);

    expect(usage?.quota).toBe(500_000);
    expect(usage?.remaining).toBe(0);
    expect(usage?.expired).toBe(0);
    expect(usage?.used).toBe(500_000);
    expect(usage?.packageStatus?.usedUpConsumed).toBe(500_000);
  });

  it("ignores rows with missing status", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        TotalAmount: "1000000",
        AvailableAmount: "900000",
        Unit: "token",
      },
      {
        TotalAmount: "500000",
        AvailableAmount: "400000",
        Unit: "token",
        Status: "Effective",
      },
    ]);

    expect(usage?.quota).toBe(500_000);
    expect(usage?.remaining).toBe(400_000);
    expect(usage?.used).toBe(100_000);
  });

  it("ignores NotEffective, FailedToCreate, and Refunded rows", () => {
    const { usage } = aggregateResourcePackageRows([
      {
        TotalAmount: "1000000",
        AvailableAmount: "900000",
        Unit: "token",
        Status: "NotEffective",
      },
      {
        TotalAmount: "1000000",
        AvailableAmount: "0",
        Unit: "token",
        Status: "FailedToCreate",
      },
      {
        TotalAmount: "1000000",
        AvailableAmount: "0",
        Unit: "token",
        Status: "Refunded",
      },
      {
        TotalAmount: "500000",
        AvailableAmount: "400000",
        Unit: "token",
        Status: "Effective",
      },
    ]);

    expect(usage?.quota).toBe(500_000);
    expect(usage?.remaining).toBe(400_000);
    expect(usage?.used).toBe(100_000);
  });
});

describe("mergeVolcanoResourcePackagesByInstance", () => {
  it("keeps UsedUp over Effective for the same InstanceNo", () => {
    const merged = mergeVolcanoResourcePackagesByInstance([
      {
        InstanceNo: "rpi-1",
        Status: "Effective",
        TotalAmount: "100",
        AvailableAmount: "50",
      },
      {
        InstanceNo: "rpi-1",
        Status: "UsedUp",
        TotalAmount: "100",
        AvailableAmount: "0",
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.Status).toBe("UsedUp");
  });

  it("retains separate instances for Effective and UsedUp renewal packages", () => {
    const merged = mergeVolcanoResourcePackagesByInstance([
      {
        InstanceNo: "rpi-effective",
        ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
        Status: "Effective",
        TotalAmount: "2262252",
        AvailableAmount: "2174952",
        Unit: "token",
      },
      {
        InstanceNo: "rpi-used-up",
        ConfigurationCode: "Doubao_Seedance_2.0_pack_free_infer",
        Status: "UsedUp",
        TotalAmount: "2737748",
        AvailableAmount: "0",
        Unit: "token",
      },
    ]);

    expect(merged).toHaveLength(2);
    const { usage } = aggregateResourcePackageRows(merged);
    expect(usage?.quota).toBe(5_000_000);
    expect(usage?.remaining).toBe(2_174_952);
    expect(usage?.used).toBe(2_825_048);
    expect(usage?.packageStatus?.usedUpCount).toBe(1);
    expect(usage?.packageStatus?.effectiveCount).toBe(1);
  });
});

describe("computeUsageBarSegments", () => {
  it("normalizes segment percents to sum to 100", () => {
    const segments = computeUsageBarSegments({
      quota: 1_800_000,
      remaining: 400_000,
      expired: 100_000,
      used: 1_300_000,
    });

    expect(segments.remainPercent).toBe(22);
    expect(segments.expiredPercent).toBe(6);
    expect(segments.usedPercent).toBe(72);
    expect(
      segments.usedPercent + segments.remainPercent + segments.expiredPercent
    ).toBe(100);
  });
});

describe("resolveVolcanoActivation", () => {
  it("treats provisioned package as open when probe is stale not_open", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "glm-5-2",
        probe: {
          status: "not_open",
          probedAt: "2026-07-11T00:00:00.000Z",
          errorCode: "ModelNotOpen",
          message: null,
        },
        packageSnapshot: {
          provisioned: true,
          matchedCodes: ["GLM_5.2_free_inference_resource_pack"],
          instanceNos: ["rpi-1"],
          configurationNames: ["pkg"],
        },
      })
    ).toBe("open");
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

  it("infers not_open for Seed when required package mapping is empty", () => {
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
    ).toBe("not_open");
  });

  it("opens Seed when Evolving free inference package is provisioned", () => {
    expect(
      resolveVolcanoEffectiveActivationStatus({
        canonicalId: "doubao-seed-evolving",
        probe: null,
        packageSnapshot: {
          provisioned: true,
          matchedCodes: ["Doubao_Seed_Evolving_free_infer_res_pack"],
          instanceNos: ["rpi-seed"],
          configurationNames: ["Doubao-Seed-Evolving免费在线推理资源包"],
        },
      })
    ).toBe("open");
  });

  it("returns open for required models with provisioned package but stale probe", () => {
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
    ).toBe("open");
  });
});

describe("enrichVolcanoProbeResultsWithPackages", () => {
  it("marks provisioned models as open when inference probe is inconclusive", () => {
    const enriched = enrichVolcanoProbeResultsWithPackages({
      results: [
        {
          canonicalId: "doubao-seedance-2",
          providerModelId: "doubao-seedance-2-0-260128",
          status: "not_open",
          errorCode: "ModelNotOpen",
          message: null,
          probedAt: "2026-07-11T00:00:00.000Z",
        },
      ],
      packageByCanonicalId: new Map([
        [
          "doubao-seedance-2",
          {
            provisioned: true,
            matchedCodes: ["Doubao_Seedance_2.0_pack_free_infer"],
            instanceNos: ["rpi-1"],
            configurationNames: ["pkg"],
          },
        ],
      ]),
    });

    expect(enriched[0]?.status).toBe("open");
  });

  it("preserves auth_error even when a package exists", () => {
    const enriched = enrichVolcanoProbeResultsWithPackages({
      results: [
        {
          canonicalId: "doubao-seedance-2",
          providerModelId: "doubao-seedance-2-0-260128",
          status: "auth_error",
          errorCode: "AuthenticationError",
          message: null,
          probedAt: "2026-07-11T00:00:00.000Z",
        },
      ],
      packageByCanonicalId: new Map([
        [
          "doubao-seedance-2",
          {
            provisioned: true,
            matchedCodes: ["Doubao_Seedance_2.0_pack_free_infer"],
            instanceNos: ["rpi-1"],
            configurationNames: ["pkg"],
          },
        ],
      ]),
    });

    expect(enriched[0]?.status).toBe("auth_error");
  });
});

describe("buildVolcanoProbeResultsFromPackages", () => {
  it("marks provisioned models as open without inference probe", () => {
    const results = buildVolcanoProbeResultsFromPackages({
      entries: [
        {
          canonicalId: "doubao-seedance-2",
          alias: "Seedance 2.0",
          modality: "video",
          providerModelId: "doubao-seedance-2-0-260128",
        },
      ],
      packageByCanonicalId: new Map([
        [
          "doubao-seedance-2",
          {
            provisioned: true,
            matchedCodes: ["Doubao_Seedance_2.0_pack_free_infer"],
            instanceNos: ["rpi-1"],
            configurationNames: ["pkg"],
          },
        ],
      ]),
    });

    expect(results[0]?.status).toBe("open");
  });

  it("reports not_open for required models without packages", () => {
    const results = buildVolcanoProbeResultsFromPackages({
      entries: [
        {
          canonicalId: "doubao-seedream-5",
          alias: "Seedream 5.0",
          modality: "image",
          providerModelId: "doubao-seedream-5-0-260128",
        },
      ],
      packageByCanonicalId: new Map([
        [
          "doubao-seedream-5",
          {
            provisioned: false,
            matchedCodes: [],
            instanceNos: [],
            configurationNames: [],
          },
        ],
      ]),
    });

    expect(results[0]?.status).toBe("not_open");
  });
});

describe("normalizeVolcanoWizardProbeResults", () => {
  it("maps inconclusive probe statuses to not_open", () => {
    const normalized = normalizeVolcanoWizardProbeResults([
      {
        canonicalId: "doubao-seedance-2",
        providerModelId: "doubao-seedance-2-0-260128",
        status: "unknown",
        errorCode: null,
        message: null,
        probedAt: "2026-07-11T00:00:00.000Z",
      },
      {
        canonicalId: "doubao-seedream-5",
        providerModelId: "doubao-seedream-5-0-260128",
        status: "open",
        errorCode: null,
        message: null,
        probedAt: "2026-07-11T00:00:00.000Z",
      },
    ]);

    expect(normalized[0]?.status).toBe("not_open");
    expect(normalized[1]?.status).toBe("open");
  });
});

describe("pruneVolcanoMetadataToCatalog", () => {
  it("drops models and activation cache entries not in catalog", () => {
    const pruned = pruneVolcanoMetadataToCatalog({
      credentialMode: "volcengine_iam",
      accessKeyId: "ak",
      secretAccessKeyEncrypted: "enc",
      region: "cn-beijing",
      models: {
        "doubao-seedream-5-pro": {
          enabled: true,
          providerModelId: "doubao-seedream-5-0-pro-260628",
          modality: "image",
        },
        "doubao-seedream-5": {
          enabled: true,
          providerModelId: "doubao-seedream-5-0-260128",
          modality: "image",
        },
      },
      modelActivationCache: {
        "doubao-seedream-5-pro": {
          status: "open",
          probedAt: "2026-07-11T00:00:00.000Z",
        },
      },
    });

    expect(pruned.models["doubao-seedream-5-pro"]).toBeUndefined();
    expect(pruned.models["doubao-seedream-5"]?.enabled).toBe(true);
    expect(pruned.modelActivationCache?.["doubao-seedream-5-pro"]).toBeUndefined();
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

    expect(
      extractVolcanoListItems({
        Endpoints: [{ Id: "c" }],
      })
    ).toHaveLength(1);
  });
});
