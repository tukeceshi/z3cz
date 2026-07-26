export const RESOURCE_FEATURE_IDS = [
  "schemas",
  "databases",
  "datasets",
  "integrations",
  "secrets",
  "ai-interfaces",
  "emails",
  "queues",
  "bots",
] as const;

/** Org sidebar workflow section — always visible, not controlled by featureConfig */
export const WORKFLOW_NAV_ITEM_IDS = [
  "workflows",
  "model-calls",
  "templates",
  "playground",
] as const;

export type WorkflowNavItemId = (typeof WORKFLOW_NAV_ITEM_IDS)[number];

/** @deprecated Use ResourceFeatureId */
export const PLATFORM_FEATURE_IDS = RESOURCE_FEATURE_IDS;

export type ResourceFeatureId = (typeof RESOURCE_FEATURE_IDS)[number];

/** @deprecated Use ResourceFeatureId */
export type PlatformFeatureId = ResourceFeatureId;

export type PlatformFeatureCategory =
  | "admin"
  | "admin_and_docker"
  | "docker_only";

export interface PlatformFeatureNavConfig {
  enabled: boolean;
}

export interface PlatformFeatureConfig {
  nav: Record<ResourceFeatureId, PlatformFeatureNavConfig>;
  defaultWorkflowSchemeId: string;
}

export const DEFAULT_PLATFORM_FEATURE_CONFIG: PlatformFeatureConfig = {
  nav: {
    "ai-interfaces": { enabled: true },
    schemas: { enabled: false },
    databases: { enabled: false },
    datasets: { enabled: false },
    integrations: { enabled: false },
    secrets: { enabled: false },
    emails: { enabled: false },
    queues: { enabled: false },
    bots: { enabled: false },
  },
  defaultWorkflowSchemeId: "basic-canvas",
};

export function mergePlatformFeatureConfig(
  partial?: Partial<PlatformFeatureConfig> | null
): PlatformFeatureConfig {
  if (!partial) {
    return DEFAULT_PLATFORM_FEATURE_CONFIG;
  }

  const nav = { ...DEFAULT_PLATFORM_FEATURE_CONFIG.nav };
  if (partial.nav) {
    for (const id of RESOURCE_FEATURE_IDS) {
      if (partial.nav[id]) {
        nav[id] = { ...nav[id], ...partial.nav[id] };
      }
    }
  }

  return {
    nav,
    defaultWorkflowSchemeId:
      partial.defaultWorkflowSchemeId ??
      DEFAULT_PLATFORM_FEATURE_CONFIG.defaultWorkflowSchemeId,
  };
}

export function isPlatformFeatureEnabled(
  config: PlatformFeatureConfig,
  featureId: ResourceFeatureId
): boolean {
  return config.nav[featureId]?.enabled ?? false;
}
