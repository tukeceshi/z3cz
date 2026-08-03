import type { NodeType } from "./workflow";
import type { VolcanoActivationProbeResult } from "./volcano-activation";
import type { VolcanoSetupStatus } from "./volcano-setup";
import type { VolcanoInterfaceMetadata, VolcanoTosStorageConfig } from "./volcano-snapshot";

export const AI_INTERFACE_NODE_TYPE = "ai-interface" as const;
export const AI_TEXT_NODE_TYPE = "ai-text" as const;
export const AI_IMAGE_NODE_TYPE = "ai-image" as const;
export const AI_VIDEO_NODE_TYPE = "ai-video" as const;
export const AI_AUDIO_NODE_TYPE = "ai-audio" as const;

export type AiGenerativeNodeType =
  | typeof AI_TEXT_NODE_TYPE
  | typeof AI_IMAGE_NODE_TYPE
  | typeof AI_VIDEO_NODE_TYPE
  | typeof AI_AUDIO_NODE_TYPE;

export const AI_GENERATIVE_NODE_TYPES: readonly AiGenerativeNodeType[] = [
  AI_TEXT_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  AI_AUDIO_NODE_TYPE,
] as const;

/** Executable when legacy is on, but omitted from the add-node panel catalog. */
export const EXECUTABLE_NON_PANEL_NODE_TYPES: readonly string[] = [
  AI_INTERFACE_NODE_TYPE,
] as const;

export function buildCatalogAllowedNodeTypeSet(
  panelNodeTypes: readonly { readonly type: string }[]
): Set<string> {
  const allowed = new Set(panelNodeTypes.map((entry) => entry.type));
  for (const nodeType of EXECUTABLE_NON_PANEL_NODE_TYPES) {
    allowed.add(nodeType);
  }
  return allowed;
}
export const AI_INTERFACE_MANIFEST_SCHEMA_VERSION = 1 as const;
export const AI_INTERFACE_RUNTIME_SCHEMA_VERSION = 1 as const;
export const AI_INTERFACE_SOURCE_SCHEMA_VERSION = 1 as const;

export type AiInterfaceProvider =
  | "openai"
  | "deepseek"
  | "doubao_volcano"
  | "custom";

export const ALL_AI_INTERFACE_PROVIDERS: readonly AiInterfaceProvider[] = [
  "openai",
  "deepseek",
  "doubao_volcano",
  "custom",
] as const;

export type AiInterfaceExecutionMode = "sync";

export type AiInterfaceFieldType =
  | "string"
  | "number"
  | "boolean"
  | "json";

export interface AiInterfaceFieldSpec {
  readonly name: string;
  readonly apiName: string;
  readonly type: AiInterfaceFieldType;
  readonly description: string;
  readonly required?: boolean;
  readonly default?: string | number | boolean;
  readonly hidden?: boolean;
  readonly enumValues?: readonly string[];
}

export type AiInterfaceBodyMapping =
  | { readonly kind: "field"; readonly from: string; readonly to: string }
  | { readonly kind: "const"; readonly to: string; readonly value: unknown }
  | { readonly kind: "model"; readonly to: string }
  | {
      readonly kind: "openai-messages";
      readonly promptField: string;
      readonly systemField?: string;
    }
  | {
      readonly kind: "anthropic-messages";
      readonly promptField: string;
    };

export interface AiInterfaceSourceSpec {
  readonly schemaVersion: typeof AI_INTERFACE_SOURCE_SCHEMA_VERSION;
  readonly meta: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly provider: AiInterfaceProvider;
    readonly icon: string;
    readonly tags: readonly string[];
    readonly enabled: boolean;
    readonly isSystem: boolean;
    readonly sortOrder: number;
    readonly isDefault?: boolean;
  };
  readonly connection: {
    readonly baseUrl: string;
    readonly authType: "bearer" | "header";
    readonly headerName?: string;
    readonly authPrefix?: string;
    readonly defaultHeaders?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
  };
  readonly execution: {
    readonly mode: AiInterfaceExecutionMode;
    readonly sync: {
      readonly method: "POST";
      readonly path: string;
      readonly bodyMappings: readonly AiInterfaceBodyMapping[];
      readonly responseTextPath: string;
      readonly usagePromptPath?: string;
      readonly usageCompletionPath?: string;
    };
  };
  readonly io: {
    readonly defaultModel: string;
    readonly models: readonly {
      readonly id: string;
      readonly label: string;
    }[];
    readonly fields: readonly AiInterfaceFieldSpec[];
    readonly outputs: readonly { readonly name: string; readonly type: string }[];
    readonly configInputs: readonly string[];
  };
}

export interface AiInterfaceBodySlot {
  readonly kind: "field" | "const" | "model" | "openai-messages" | "anthropic-messages";
  readonly to: string;
  readonly from?: string;
  readonly value?: unknown;
  readonly promptField?: string;
  readonly systemField?: string;
}

export interface AiInterfaceRuntimeArtifact {
  readonly schemaVersion: typeof AI_INTERFACE_RUNTIME_SCHEMA_VERSION;
  readonly templateId: string;
  readonly version: number;
  readonly checksum: string;
  readonly provider: AiInterfaceProvider;
  readonly connection: {
    readonly baseUrl: string;
    readonly authType: "bearer" | "header";
    readonly headerName: string;
    readonly authPrefix: string;
    readonly defaultHeaders: Readonly<Record<string, string>>;
    readonly timeoutMs: number;
  };
  readonly execution: {
    readonly mode: "sync";
    readonly sync: {
      readonly method: "POST";
      readonly path: string;
      readonly bodySlots: readonly AiInterfaceBodySlot[];
      readonly responseTextPath: readonly string[];
      readonly usagePromptPath?: readonly string[];
      readonly usageCompletionPath?: readonly string[];
    };
  };
  readonly nodeType: NodeType;
  readonly fields: readonly AiInterfaceFieldSpec[];
  readonly testPayload: Readonly<Record<string, unknown>>;
}

export interface AiInterfaceManifest {
  readonly schemaVersion: typeof AI_INTERFACE_MANIFEST_SCHEMA_VERSION;
  readonly manifestVersion: number;
  readonly checksum: string;
  readonly generatedAt: string;
  readonly nodeTypes: readonly NodeType[];
}

export interface OrganizationAiInterface {
  readonly id: string;
  readonly organizationId: string;
  /** @deprecated Legacy template linkage; unused after template retirement. */
  readonly templateId?: string | null;
  /** @deprecated Legacy template revision pin; unused after template retirement. */
  readonly templateVersion?: number | null;
  readonly name: string;
  readonly provider: AiInterfaceProvider;
  readonly baseUrl?: string | null;
  readonly selectedModel?: string | null;
  readonly enabled: boolean;
  readonly isDefault: boolean;
  readonly hasApiKey: boolean;
  readonly apiKeyHint?: string | null;
  readonly metadata?: VolcanoInterfaceMetadata | Readonly<Record<string, unknown>> | null;
  readonly volcanoSetupStatus?: VolcanoSetupStatus | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListOrganizationAiInterfacesResponse {
  readonly interfaces: OrganizationAiInterface[];
}

export interface CreateOrganizationAiInterfaceRequest {
  readonly provider: AiInterfaceProvider;
  readonly name: string;
  readonly apiKey?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly enabledModels?: readonly string[];
  readonly volcanoActivationResults?: readonly VolcanoActivationProbeResult[];
  readonly baseUrl?: string | null;
  readonly selectedModel?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly enabled?: boolean;
  readonly isDefault?: boolean;
  readonly tosStorage?: {
    readonly enabled: boolean;
    readonly bucket: string;
    readonly region: string;
    readonly createBucket?: boolean;
  };
}

export interface UpdateOrganizationAiInterfaceRequest {
  readonly name?: string;
  readonly apiKey?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly baseUrl?: string | null;
  readonly selectedModel?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly volcanoModelEnabled?: Readonly<Record<string, boolean>>;
  readonly volcanoModelAlias?: Readonly<Record<string, string>>;
  readonly singleModelModelEnabled?: Readonly<Record<string, boolean>>;
  readonly singleModelModelAlias?: Readonly<Record<string, string>>;
  readonly singleModelUpstreamModelIds?: Readonly<Record<string, string>>;
  readonly tosStorage?: VolcanoTosStorageConfig & {
    readonly createBucket?: boolean;
  };
  readonly enabled?: boolean;
  readonly isDefault?: boolean;
}

export interface ResolvedOrgAiInterface {
  readonly interfaceId: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly selectedModel: string;
  readonly artifact: AiInterfaceRuntimeArtifact;
}

export function withSelectedModel(
  resolved: ResolvedOrgAiInterface,
  model?: unknown
): ResolvedOrgAiInterface {
  if (typeof model === "string" && model.trim().length > 0) {
    return { ...resolved, selectedModel: model.trim() };
  }
  return resolved;
}
