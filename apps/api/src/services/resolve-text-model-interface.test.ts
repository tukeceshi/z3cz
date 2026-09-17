import type {
  OrganizationAiInterface,
  PlatformAiModel,
  PlatformAiModelParameterRules,
  VolcanoInterfaceMetadata,
} from "@dafthunk/types";
import {
  DEFAULT_TEXT_MODEL_PARAMETER_RULES,
  isOfficialOrgModelEndpoint,
  VOLCANO_AGGREGATE_MODEL_CATALOG,
} from "@dafthunk/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listOrganizationAiInterfaces } = vi.hoisted(() => ({
  listOrganizationAiInterfaces: vi.fn(),
}));

vi.mock("../db/ai-interface-queries", () => ({
  listOrganizationAiInterfaces,
}));

import {
  ensureVolcanoModelsIncludePlatformCatalog,
  resolveOrgModelInterfaceBinding,
  toVolcanoCatalogEntriesFromPlatform,
} from "./resolve-text-model-interface";

const testTextRules =
  DEFAULT_TEXT_MODEL_PARAMETER_RULES as PlatformAiModelParameterRules;

describe("toVolcanoCatalogEntriesFromPlatform", () => {
  it("maps platform models using static volcano catalog providerModelIds", () => {
    const models: readonly PlatformAiModel[] = [
      {
        canonicalId: "deepseek-v4-flash",
        displayName: "DeepSeek V4 Flash",
        modality: "text",
        platformEnabled: true,
        sortOrder: 0,
        brandIcon: null,
        description: "",
        parameterRules: testTextRules,
      },
    ];

    expect(
      toVolcanoCatalogEntriesFromPlatform(
        models,
        VOLCANO_AGGREGATE_MODEL_CATALOG
      )
    ).toEqual([
      {
        canonicalId: "deepseek-v4-flash",
        alias: "DeepSeek V4 Flash",
        modality: "text",
        providerModelId: "deepseek-v4-flash-260425",
      },
    ]);
  });

  it("excludes Moonshot brand-only platform models from volcano catalog", () => {
    const models: readonly PlatformAiModel[] = [
      {
        canonicalId: "kimi-k3",
        displayName: "Kimi K3",
        modality: "text",
        platformEnabled: true,
        sortOrder: 41,
        brandIcon: null,
        description: "",
        parameterRules: testTextRules,
      },
      {
        canonicalId: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
        modality: "text",
        platformEnabled: true,
        sortOrder: 0,
        brandIcon: null,
        description: "",
        parameterRules: testTextRules,
      },
    ];

    expect(
      toVolcanoCatalogEntriesFromPlatform(
        models,
        VOLCANO_AGGREGATE_MODEL_CATALOG
      )
    ).toEqual([
      {
        canonicalId: "deepseek-v4-pro",
        alias: "DeepSeek V4 Pro",
        modality: "text",
        providerModelId: "deepseek-v4-pro-260425",
      },
    ]);
  });
});

const volcanoSeedreamInterface: OrganizationAiInterface = {
  id: "iface-1",
  organizationId: "org-1",
  name: "Volcano",
  provider: "doubao_volcano",
  enabled: true,
  isDefault: true,
  hasApiKey: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  metadata: {
    credentialMode: "volcengine_iam",
    accessKeyId: "ak",
    secretAccessKeyEncrypted: "enc",
    arkApiKeyDurationSeconds: 3600,
    region: "cn-beijing",
    models: {
      "doubao-seedream-5": {
        canonicalId: "doubao-seedream-5",
        enabled: true,
        upstreamModelId: "seedream-id",
        modality: "image",
      },
    },
  },
};

describe("resolveOrgModelInterfaceBinding", () => {
  beforeEach(() => {
    listOrganizationAiInterfaces.mockReset();
    listOrganizationAiInterfaces.mockResolvedValue([volcanoSeedreamInterface]);
  });

  it("resolves using modality-specific options without requiring text catalog membership", async () => {
    const db = {} as import("../db").Database;
    const listOptions = vi.fn(async () => [
      {
        instanceId: "doubao-seedream-5",
        canonicalId: "doubao-seedream-5",
        interfaceId: "iface-1",
        selectable: true,
        displayName: "[聚合] Seedream 5",
        channelKind: "aggregate" as const,
        providerModelId: "seedream-id",
        parameterRules: { promptMaxChars: 2000 },
      },
    ]);

    const resolved = await resolveOrgModelInterfaceBinding(
      db,
      "org-1",
      "doubao-seedream-5",
      "iface-1",
      listOptions
    );

    expect(resolved).toEqual({
      instanceId: "doubao-seedream-5",
      canonicalId: "doubao-seedream-5",
      displayName: "[聚合] Seedream 5",
      interfaceId: "iface-1",
      interfaceName: "Volcano",
      channelKind: "aggregate",
      providerModelId: "seedream-id",
      parameterRules: { promptMaxChars: 2000 },
    });
    expect(listOptions).toHaveBeenCalledWith(db, "org-1");
    expect(listOrganizationAiInterfaces).toHaveBeenCalledWith(db, "org-1");
  });

  it("returns null when binding is not selectable", async () => {
    const db = {} as import("../db").Database;
    const listOptions = vi.fn(async () => [
      {
        instanceId: "doubao-seedream-5",
        canonicalId: "doubao-seedream-5",
        interfaceId: "iface-1",
        selectable: false,
        displayName: "[聚合] Seedream 5",
        channelKind: "aggregate" as const,
        providerModelId: "seedream-id",
        parameterRules: { promptMaxChars: 2000 },
      },
    ]);

    const resolved = await resolveOrgModelInterfaceBinding(
      db,
      "org-1",
      "doubao-seedream-5",
      "iface-1",
      listOptions
    );

    expect(resolved).toBeNull();
    expect(listOrganizationAiInterfaces).not.toHaveBeenCalled();
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
          canonicalId: "deepseek-v4-pro",
          enabled: true,
          upstreamModelId: "deepseek-v4-pro-260425",
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
      canonicalId: "deepseek-v4-flash",
      upstreamModelId: "deepseek-v4-flash-260425",
      modality: "text",
    });
  });

  it("does not overwrite existing providerModelId", () => {
    const metadata: VolcanoInterfaceMetadata = {
      credentialMode: "volcengine_iam",
      accessKeyId: "ak",
      secretAccessKeyEncrypted: "enc",
      arkApiKeyDurationSeconds: 3600,
      region: "cn-beijing",
      models: {
        "glm-5-2": {
          canonicalId: "glm-5-2",
          enabled: true,
          upstreamModelId: "glm-5.2",
          modality: "text",
        },
      },
    };

    const next = ensureVolcanoModelsIncludePlatformCatalog(metadata, [
      {
        canonicalId: "glm-5-2",
        alias: "GLM-5.2",
        modality: "text",
        providerModelId: "glm-5-2-260617",
      },
    ]);

    expect(next.models["glm-5-2"]).toEqual({
      enabled: true,
      canonicalId: "glm-5-2",
      upstreamModelId: "glm-5.2",
      modality: "text",
    });
  });
});

describe("isOfficialOrgModelEndpoint", () => {
  it("treats aggregate as official", () => {
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "aggregate",
        baseUrl: "https://relay.example.com",
      })
    ).toBe(true);
  });

  it("matches single-model official root domains and rejects relays", () => {
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://api.deepseek.com",
      })
    ).toBe(true);
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      })
    ).toBe(true);
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://api.moonshot.cn/v1",
      })
    ).toBe(true);
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://relay.example.com/v1",
      })
    ).toBe(false);
  });
});
