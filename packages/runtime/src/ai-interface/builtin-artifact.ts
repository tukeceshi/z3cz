import type {
  AiInterfaceProvider,
  AiInterfaceRuntimeArtifact,
} from "@dafthunk/types";
import { VOLCANO_PRODUCT_DISPLAY_NAME_ZH } from "@dafthunk/types";

import {
  compileAiInterfaceSourceSpec,
  createOpenAiCompatibleChatSourceSpec,
} from "./compile";

const BUILTIN_VERSION = 1 as const;

const PROVIDER_DEFAULTS: Readonly<
  Record<
    Exclude<AiInterfaceProvider, "custom">,
    {
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly baseUrl: string;
      readonly defaultModel: string;
      readonly models: readonly { id: string; label: string }[];
      readonly tags: readonly string[];
    }
  >
> = {
  openai: {
    id: "builtin:openai",
    name: "OpenAI Chat",
    description: "OpenAI-compatible chat completions (GPT models).",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4o", label: "GPT-4o" },
    ],
    tags: ["AI", "OpenAI"],
  },
  deepseek: {
    id: "builtin:deepseek",
    name: "DeepSeek Chat",
    description: "DeepSeek OpenAI-compatible chat API.",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
    tags: ["AI", "DeepSeek"],
  },
  doubao_volcano: {
    id: "builtin:doubao_volcano",
    name: VOLCANO_PRODUCT_DISPLAY_NAME_ZH,
    description:
      "Volcano Engine Ark. Provide IAM Access Key; inference API key is issued automatically.",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-evolving",
    models: [{ id: "doubao-seed-evolving", label: "Doubao Seed Evolving" }],
    tags: ["AI", "Doubao", "Volcano"],
  },
};

/**
 * Build an OpenAI-compatible chat runtime artifact in memory.
 * Replaces R2-backed AI interface templates.
 */
export function buildBuiltinAiInterfaceArtifact(
  provider: AiInterfaceProvider,
  options?: {
    readonly baseUrl?: string | null;
    readonly defaultModel?: string | null;
  }
): AiInterfaceRuntimeArtifact {
  if (provider === "custom") {
    const baseUrl = options?.baseUrl?.trim();
    if (!baseUrl) {
      throw new Error("Custom AI interfaces require a base URL");
    }
    const defaultModel = options?.defaultModel?.trim() || "default";
    const source = createOpenAiCompatibleChatSourceSpec({
      id: "builtin:custom",
      name: "Custom OpenAI-compatible",
      description: "Custom OpenAI-compatible chat completions endpoint.",
      provider: "custom",
      baseUrl,
      defaultModel,
      models: [{ id: defaultModel, label: defaultModel }],
      tags: ["AI", "Custom"],
    });
    return compileAiInterfaceSourceSpec({
      source,
      version: BUILTIN_VERSION,
    });
  }

  const defaults = PROVIDER_DEFAULTS[provider];
  const source = createOpenAiCompatibleChatSourceSpec({
    id: defaults.id,
    name: defaults.name,
    description: defaults.description,
    provider,
    baseUrl: options?.baseUrl?.trim() || defaults.baseUrl,
    defaultModel: options?.defaultModel?.trim() || defaults.defaultModel,
    models: defaults.models,
    tags: defaults.tags,
  });
  return compileAiInterfaceSourceSpec({
    source,
    version: BUILTIN_VERSION,
  });
}

export function defaultBaseUrlForProvider(
  provider: AiInterfaceProvider
): string | undefined {
  if (provider === "custom") {
    return undefined;
  }
  return PROVIDER_DEFAULTS[provider].baseUrl;
}
