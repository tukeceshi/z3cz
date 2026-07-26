import { describe, expect, it } from "vitest";

import {
  compileAiInterfaceSourceSpec,
  createAnthropicMessagesSourceSpec,
  createOpenAiCompatibleChatSourceSpec,
  computeAiInterfaceChecksum,
  buildAiInterfaceManifest,
} from "./compile";

describe("compileAiInterfaceSourceSpec", () => {
  it("compiles OpenAI-compatible chat template into runtime artifact", () => {
    const source = createOpenAiCompatibleChatSourceSpec({
      id: "openai-chat-v1",
      name: "OpenAI Chat",
      description: "OpenAI chat completions",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini",
      models: [{ id: "gpt-4o-mini", label: "GPT-4o mini" }],
    });

    const artifact = compileAiInterfaceSourceSpec({ source, version: 1 });

    expect(artifact.templateId).toBe("openai-chat-v1");
    expect(artifact.execution.sync.path).toBe("/chat/completions");
    expect(artifact.execution.sync.responseTextPath).toEqual([
      "choices",
      "0",
      "message",
      "content",
    ]);
    expect(artifact.nodeType.type).toBe("ai-interface");
    expect(artifact.nodeType.id).toBe("ai-interface-openai-chat-v1");
    expect(artifact.checksum).toHaveLength(64);
  });

  it("compiles Anthropic Messages template into runtime artifact", () => {
    const source = createAnthropicMessagesSourceSpec({
      id: "claude-messages-v1",
      name: "Claude Messages",
      description: "Anthropic Messages API",
      provider: "custom",
      baseUrl: "https://api.anthropic.com",
      defaultModel: "claude-sonnet-5",
      models: [{ id: "claude-sonnet-5", label: "Claude Sonnet 5" }],
    });

    const artifact = compileAiInterfaceSourceSpec({ source, version: 1 });

    expect(artifact.execution.sync.path).toBe("/v1/messages");
    expect(artifact.connection.headerName).toBe("x-api-key");
    expect(artifact.connection.defaultHeaders["anthropic-version"]).toBe(
      "2023-06-01"
    );
    expect(artifact.execution.sync.responseTextPath).toEqual([
      "content",
      "0",
      "text",
    ]);
  });

  it("builds manifest with full node type list", () => {
    const openai = compileAiInterfaceSourceSpec({
      source: createOpenAiCompatibleChatSourceSpec({
        id: "openai-chat-v1",
        name: "OpenAI Chat",
        description: "OpenAI",
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        models: [{ id: "gpt-4o-mini", label: "GPT-4o mini" }],
      }),
      version: 1,
    });
    const deepseek = compileAiInterfaceSourceSpec({
      source: createOpenAiCompatibleChatSourceSpec({
        id: "deepseek-chat-v1",
        name: "DeepSeek Chat",
        description: "DeepSeek",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        defaultModel: "deepseek-chat",
        models: [{ id: "deepseek-chat", label: "DeepSeek Chat" }],
      }),
      version: 1,
    });

    const manifest = buildAiInterfaceManifest({
      manifestVersion: 2,
      artifacts: [openai, deepseek],
    });

    expect(manifest.nodeTypes).toHaveLength(2);
    expect(manifest.manifestVersion).toBe(2);
    expect(manifest.checksum).toHaveLength(64);
  });

  it("produces stable checksums", () => {
    const source = createOpenAiCompatibleChatSourceSpec({
      id: "deepseek-chat-v1",
      name: "DeepSeek Chat",
      description: "DeepSeek",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      defaultModel: "deepseek-chat",
      models: [{ id: "deepseek-chat", label: "DeepSeek Chat" }],
    });

    const first = compileAiInterfaceSourceSpec({ source, version: 1 });
    const second = compileAiInterfaceSourceSpec({ source, version: 1 });
    expect(first.checksum).toBe(second.checksum);
    const { checksum, ...artifactBody } = first;
    expect(computeAiInterfaceChecksum(artifactBody)).toBe(checksum);
  });
});
