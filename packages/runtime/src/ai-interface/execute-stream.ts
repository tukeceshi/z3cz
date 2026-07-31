import type {
  AiInterfaceRuntimeArtifact,
  ResolvedOrgAiInterface,
} from "@dafthunk/types";

import { buildBodyFromSlots } from "./build-body";
import { resolveSyncRequestUrl } from "./execute-sync";

export type AiInterfaceStreamEvent =
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "done"; readonly text: string }
  | { readonly type: "error"; readonly error: string };

function readOpenAiStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return "";
  }
  const delta = (first as { delta?: unknown }).delta;
  if (!delta || typeof delta !== "object") {
    return "";
  }
  const content = (delta as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

/**
 * Stream OpenAI-compatible chat completions. Accumulates text server-side and
 * yields deltas for the client; final `done` carries the full text once.
 */
export async function* iterateAiInterfaceChatStream(params: {
  readonly resolved: ResolvedOrgAiInterface;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly bodyExtensions?: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
  /** Overall idle/hard timeout. Default 10 minutes for long Seed replies. */
  readonly timeoutMs?: number;
}): AsyncGenerator<AiInterfaceStreamEvent> {
  const artifact = params.resolved.artifact;
  if (artifact.execution.mode !== "sync") {
    yield { type: "error", error: "Only sync templates are supported" };
    return;
  }

  const sync = artifact.execution.sync;
  const supportsOpenAiMessages = sync.bodySlots.some(
    (slot) => slot.kind === "openai-messages"
  );
  if (!supportsOpenAiMessages) {
    yield {
      type: "error",
      error: "Streaming is only supported for OpenAI-compatible chat interfaces",
    };
    return;
  }

  const bodyResult = buildBodyFromSlots({
    slots: sync.bodySlots,
    inputs: params.inputs,
    model: params.resolved.selectedModel,
    fields: artifact.fields,
  });

  if ("error" in bodyResult) {
    yield { type: "error", error: (bodyResult as { error: string }).error };
    return;
  }

  const url = resolveSyncRequestUrl(params.resolved.baseUrl, sync.path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...artifact.connection.defaultHeaders,
  };
  const authHeader = artifact.connection.headerName;
  headers[authHeader] =
    `${artifact.connection.authPrefix}${params.resolved.apiKey}`;

  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 600_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = (): void => {
    controller.abort();
  };
  params.signal?.addEventListener("abort", onAbort);

  let fullText = "";

  try {
    const response = await fetch(url, {
      method: sync.method,
      headers,
      body: JSON.stringify({
        ...bodyResult,
        ...(params.bodyExtensions ?? {}),
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      yield {
        type: "error",
        error: `Upstream request failed (${response.status}): ${text}`,
      };
      return;
    }

    if (!response.body) {
      yield { type: "error", error: "Upstream returned no stream body" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) {
          continue;
        }
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(data) as unknown;
        } catch {
          continue;
        }

        const delta = readOpenAiStreamDelta(parsed);
        if (!delta) {
          continue;
        }
        fullText += delta;
        yield { type: "delta", text: delta };
      }
    }

    if (!fullText.trim()) {
      yield { type: "error", error: "Upstream stream returned no text" };
      return;
    }

    yield { type: "done", text: fullText };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown upstream error";
    yield { type: "error", error: message };
  } finally {
    clearTimeout(timeout);
    params.signal?.removeEventListener("abort", onAbort);
  }
}

export function artifactSupportsChatStream(
  artifact: AiInterfaceRuntimeArtifact
): boolean {
  if (artifact.execution.mode !== "sync") {
    return false;
  }
  return artifact.execution.sync.bodySlots.some(
    (slot) => slot.kind === "openai-messages"
  );
}
