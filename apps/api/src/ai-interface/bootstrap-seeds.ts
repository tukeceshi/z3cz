import type { AiInterfaceSourceSpec } from "@dafthunk/types";
import { VOLCANO_PRODUCT_DISPLAY_NAME_ZH } from "@dafthunk/types";
import { createOpenAiCompatibleChatSourceSpec } from "@dafthunk/runtime/ai-interface/compile";

import type { Bindings } from "../context";
import {
  AiInterfaceTemplateStore,
  bootstrapAiInterfaceTemplates,
} from "../stores/ai-interface-template-store";

export const AI_INTERFACE_BOOTSTRAP_SEEDS: readonly AiInterfaceSourceSpec[] = [
  createOpenAiCompatibleChatSourceSpec({
    id: "openai-chat-v1",
    name: "OpenAI Chat",
    description: "OpenAI-compatible chat completions (GPT models).",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4o", label: "GPT-4o" },
    ],
    icon: "bot",
    tags: ["AI", "OpenAI"],
    isSystem: true,
    sortOrder: 10,
  }),
  createOpenAiCompatibleChatSourceSpec({
    id: "deepseek-chat-v1",
    name: "DeepSeek Chat",
    description: "DeepSeek OpenAI-compatible chat API.",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
    icon: "bot",
    tags: ["AI", "DeepSeek"],
    isSystem: true,
    sortOrder: 20,
  }),
  createOpenAiCompatibleChatSourceSpec({
    id: "doubao-volcano-chat-v1",
    name: VOLCANO_PRODUCT_DISPLAY_NAME_ZH,
    description:
      "Volcano Engine Ark. Provide IAM Access Key; inference API key is issued automatically.",
    provider: "doubao_volcano",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-evolving",
    models: [{ id: "doubao-seed-evolving", label: "Doubao Seed Evolving" }],
    icon: "bot",
    tags: ["AI", "Doubao", "Volcano"],
    isSystem: true,
    sortOrder: 30,
  }),
];

export async function ensureAiInterfaceBootstrap(env: Bindings): Promise<void> {
  await bootstrapAiInterfaceTemplates(env, AI_INTERFACE_BOOTSTRAP_SEEDS);
}

export function createAiInterfaceTemplateStore(
  env: Bindings
): AiInterfaceTemplateStore {
  return new AiInterfaceTemplateStore(env);
}
