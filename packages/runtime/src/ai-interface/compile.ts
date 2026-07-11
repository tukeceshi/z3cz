import { createHash } from "node:crypto";

import type {
  AiInterfaceBodyMapping,
  AiInterfaceBodySlot,
  AiInterfaceFieldSpec,
  AiInterfaceManifest,
  AiInterfaceRuntimeArtifact,
  AiInterfaceSourceSpec,
  NodeType,
} from "@dafthunk/types";
import {
  AI_INTERFACE_MANIFEST_SCHEMA_VERSION,
  AI_INTERFACE_NODE_TYPE,
  AI_INTERFACE_RUNTIME_SCHEMA_VERSION,
} from "@dafthunk/types";

import { splitDotPath } from "./extract-path";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function computeAiInterfaceChecksum(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function mapBodySlot(mapping: AiInterfaceBodyMapping): AiInterfaceBodySlot {
  if (mapping.kind === "field") {
    return { kind: "field", from: mapping.from, to: mapping.to };
  }
  if (mapping.kind === "const") {
    return { kind: "const", to: mapping.to, value: mapping.value };
  }
  if (mapping.kind === "model") {
    return { kind: "model", to: mapping.to };
  }
  return {
    kind: "openai-messages",
    to: "messages",
    promptField: mapping.promptField,
    systemField: mapping.systemField,
  };
}

function fieldsToNodeInputs(
  fields: readonly AiInterfaceFieldSpec[]
): NodeType["inputs"] {
  return fields.map((field) => ({
    name: field.name,
    type: field.type === "json" ? "json" : field.type,
    description: field.description,
    required: field.required,
    default: field.default,
    hidden: field.hidden,
    ...(field.enumValues ? { enum: [...field.enumValues] } : {}),
  }));
}

function buildNodeType(
  source: AiInterfaceSourceSpec,
  version: number
): NodeType {
  const configInputs = new Set([
    "ai_interface_id",
    "model",
    ...source.io.configInputs,
  ]);

  const userFields = source.io.fields.filter(
    (field) => !configInputs.has(field.name)
  );

  return {
    id: `ai-interface-${source.meta.id}`,
    name: source.meta.name,
    type: AI_INTERFACE_NODE_TYPE,
    description: source.meta.description,
    documentation: source.meta.description,
    tags: [...source.meta.tags],
    icon: source.meta.icon,
    inlinable: false,
    usage: 0,
    metadata: {
      aiInterfaceTemplateId: source.meta.id,
      aiInterfaceProvider: source.meta.provider,
      aiInterfaceVersion: String(version),
    },
    inputs: [
      {
        name: "ai_interface_id",
        type: "string",
        description:
          "Organization AI interface instance ID. Leave empty to use the org default for this provider.",
        required: false,
        hidden: true,
      },
      {
        name: "model",
        type: "string",
        description: "Model identifier",
        required: false,
        default: source.io.defaultModel,
        enum: source.io.models.map((model) => model.id),
      },
      ...fieldsToNodeInputs(userFields),
    ],
    outputs: source.io.outputs.map((output) => ({
      name: output.name,
      type: "string" as const,
      description: output.name,
    })),
  };
}

function buildTestPayload(source: AiInterfaceSourceSpec): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: source.io.defaultModel,
  };

  for (const field of source.io.fields) {
    if (field.default !== undefined) {
      payload[field.name] = field.default;
      continue;
    }
    if (field.name === "prompt") {
      payload.prompt = "ping";
    }
  }

  return payload;
}

export function compileAiInterfaceSourceSpec(params: {
  source: AiInterfaceSourceSpec;
  version: number;
}): AiInterfaceRuntimeArtifact {
  const { source, version } = params;
  const sync = source.execution.sync;

  const artifactWithoutChecksum: Omit<AiInterfaceRuntimeArtifact, "checksum"> = {
    schemaVersion: AI_INTERFACE_RUNTIME_SCHEMA_VERSION,
    templateId: source.meta.id,
    version,
    provider: source.meta.provider,
    connection: {
      baseUrl: source.connection.baseUrl.replace(/\/$/, ""),
      authType: source.connection.authType,
      headerName:
        source.connection.headerName ??
        (source.connection.authType === "header" ? "X-Api-Key" : "Authorization"),
      authPrefix:
        source.connection.authPrefix ??
        (source.connection.authType === "bearer" ? "Bearer " : ""),
      defaultHeaders: source.connection.defaultHeaders ?? {},
      timeoutMs: source.connection.timeoutMs ?? 60_000,
    },
    execution: {
      mode: "sync",
      sync: {
        method: "POST",
        path: sync.path.startsWith("/") ? sync.path : `/${sync.path}`,
        bodySlots: sync.bodyMappings.map(mapBodySlot),
        responseTextPath: [...splitDotPath(sync.responseTextPath)],
        usagePromptPath: sync.usagePromptPath
          ? [...splitDotPath(sync.usagePromptPath)]
          : undefined,
        usageCompletionPath: sync.usageCompletionPath
          ? [...splitDotPath(sync.usageCompletionPath)]
          : undefined,
      },
    },
    nodeType: buildNodeType(source, version),
    fields: [...source.io.fields],
    testPayload: buildTestPayload(source),
  };

  const checksum = computeAiInterfaceChecksum(artifactWithoutChecksum);

  return {
    ...artifactWithoutChecksum,
    checksum,
  };
}

export function buildAiInterfaceManifest(params: {
  manifestVersion: number;
  artifacts: readonly AiInterfaceRuntimeArtifact[];
}): AiInterfaceManifest {
  const nodeTypes = params.artifacts.map((artifact) => artifact.nodeType);
  const body = {
    schemaVersion: AI_INTERFACE_MANIFEST_SCHEMA_VERSION,
    manifestVersion: params.manifestVersion,
    generatedAt: new Date().toISOString(),
    nodeTypes,
  };

  return {
    ...body,
    checksum: computeAiInterfaceChecksum(body),
    nodeTypes,
  };
}

export function createOpenAiCompatibleChatSourceSpec(params: {
  id: string;
  name: string;
  description: string;
  provider: AiInterfaceSourceSpec["meta"]["provider"];
  baseUrl: string;
  defaultModel: string;
  models: readonly { id: string; label: string }[];
  icon?: string;
  tags?: readonly string[];
  isSystem?: boolean;
  sortOrder?: number;
}): AiInterfaceSourceSpec {
  return {
    schemaVersion: 1,
    meta: {
      id: params.id,
      name: params.name,
      description: params.description,
      provider: params.provider,
      icon: params.icon ?? "bot",
      tags: params.tags ?? ["AI", "LLM"],
      enabled: true,
      isSystem: params.isSystem ?? true,
      sortOrder: params.sortOrder ?? 0,
    },
    connection: {
      baseUrl: params.baseUrl,
      authType: "bearer",
      authPrefix: "Bearer ",
      timeoutMs: 60_000,
    },
    execution: {
      mode: "sync",
      sync: {
        method: "POST",
        path: "/chat/completions",
        bodyMappings: [
          { kind: "model", to: "model" },
          {
            kind: "openai-messages",
            promptField: "prompt",
            systemField: "instructions",
          },
        ],
        responseTextPath: "choices.0.message.content",
        usagePromptPath: "usage.prompt_tokens",
        usageCompletionPath: "usage.completion_tokens",
      },
    },
    io: {
      defaultModel: params.defaultModel,
      models: params.models,
      configInputs: ["ai_interface_id", "model"],
      fields: [
        {
          name: "instructions",
          apiName: "instructions",
          type: "string",
          description: "Optional system instructions",
        },
        {
          name: "prompt",
          apiName: "prompt",
          type: "string",
          description: "User prompt",
          required: true,
        },
      ],
      outputs: [{ name: "text", type: "string" }],
    },
  };
}
