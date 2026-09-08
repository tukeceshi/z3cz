import type {
  AiInterfaceRuntimeArtifact,
  ResolvedOrgAiInterface,
} from "@dafthunk/types";

import { buildBodyFromSlots } from "./build-body";
import { resolveSyncRequestUrl } from "./execute-sync";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "./upstream-request-log";

export interface AiInterfaceStreamToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export type AiInterfaceStreamEvent =
  | { readonly type: "delta"; readonly text: string; readonly thinking?: string }
  | {
      readonly type: "done";
      readonly text: string;
      readonly thinking?: string;
      readonly toolCalls?: readonly AiInterfaceStreamToolCall[];
    }
  | { readonly type: "error"; readonly error: string };

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

function longestIncompleteSuffix(text: string, tag: string): number {
  const max = Math.min(tag.length - 1, text.length);
  for (let length = max; length > 0; length -= 1) {
    if (text.endsWith(tag.slice(0, length))) {
      return length;
    }
  }
  return 0;
}

export function splitThinkTags(raw: string): {
  readonly thinking: string;
  readonly talk: string;
} {
  const thinkingParts: string[] = [];
  const talkParts: string[] = [];
  let index = 0;
  let inThink = false;
  while (index < raw.length) {
    if (!inThink) {
      const start = raw.indexOf(THINK_OPEN, index);
      if (start < 0) {
        const rest = raw.slice(index);
        const hold = longestIncompleteSuffix(rest, THINK_OPEN);
        talkParts.push(hold > 0 ? rest.slice(0, rest.length - hold) : rest);
        break;
      }
      talkParts.push(raw.slice(index, start));
      index = start + THINK_OPEN.length;
      inThink = true;
      continue;
    }
    const end = raw.indexOf(THINK_CLOSE, index);
    if (end < 0) {
      const rest = raw.slice(index);
      const hold = longestIncompleteSuffix(rest, THINK_CLOSE);
      thinkingParts.push(hold > 0 ? rest.slice(0, rest.length - hold) : rest);
      break;
    }
    thinkingParts.push(raw.slice(index, end));
    index = end + THINK_CLOSE.length;
    inThink = false;
  }
  return {
    thinking: thinkingParts.join(""),
    talk: talkParts.join(""),
  };
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

function readChoiceDelta(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return undefined;
  }
  return (first as { delta?: unknown }).delta ?? (first as { message?: unknown }).message;
}

function readOpenAiStreamDelta(payload: unknown): string {
  const delta = readChoiceDelta(payload);
  if (!delta || typeof delta !== "object") {
    return "";
  }
  const content = (delta as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export function readOpenAiReasoningDelta(payload: unknown): string {
  const delta = readChoiceDelta(payload);
  if (!delta || typeof delta !== "object") {
    return "";
  }
  const row = delta as {
    readonly reasoning_content?: unknown;
    readonly reasoning?: unknown;
    readonly thinking?: unknown;
  };
  if (typeof row.reasoning_content === "string") {
    return row.reasoning_content;
  }
  if (typeof row.reasoning === "string") {
    return row.reasoning;
  }
  if (typeof row.thinking === "string") {
    return row.thinking;
  }
  return "";
}

function sliceNewSuffix(previous: string, next: string): string {
  return next.startsWith(previous) ? next.slice(previous.length) : "";
}

function applyOpenAiToolCallDeltas(
  acc: AccumulatedToolCall[],
  payload: unknown
): void {
  const delta = readChoiceDelta(payload);
  if (!delta || typeof delta !== "object") {
    return;
  }
  const toolCalls = (delta as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(toolCalls)) {
    return;
  }
  for (const raw of toolCalls) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const item = raw as {
      readonly index?: unknown;
      readonly id?: unknown;
      readonly function?: { readonly name?: unknown; readonly arguments?: unknown };
    };
    const index = typeof item.index === "number" ? item.index : acc.length;
    const current = acc[index] ?? { id: "", name: "", arguments: "" };
    const fn = item.function;
    acc[index] = {
      id: typeof item.id === "string" && item.id ? item.id : current.id,
      name:
        fn && typeof fn.name === "string" && fn.name ? fn.name : current.name,
      arguments:
        current.arguments +
        (fn && typeof fn.arguments === "string" ? fn.arguments : ""),
    };
  }
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
  readonly upstreamLog?: UpstreamRequestLogSink;
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

  const url = resolveSyncRequestUrl(params.resolved.baseUrl, sync.path, {
    useFullSubmitUrl: params.resolved.useFullSubmitUrl,
  });
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

  let rawContent = "";
  let emittedTalk = "";
  let emittedTagThinking = "";
  let reasoningAcc = "";
  let fullText = "";
  let fullThinking = "";
  const toolAcc: AccumulatedToolCall[] = [];

  try {
    const response = await fetchWithUpstreamLog(
      url,
      {
        method: sync.method,
        headers,
        body: JSON.stringify({
          ...bodyResult,
          ...(params.bodyExtensions ?? {}),
          stream: true,
        }),
        signal: controller.signal,
      },
      params.upstreamLog,
      { responseMode: "stream" }
    );

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

        applyOpenAiToolCallDeltas(toolAcc, parsed);
        const reasoningDelta = readOpenAiReasoningDelta(parsed);
        const contentDelta = readOpenAiStreamDelta(parsed);
        if (!reasoningDelta && !contentDelta) {
          continue;
        }
        reasoningAcc += reasoningDelta;
        rawContent += contentDelta;
        const split = splitThinkTags(rawContent);
        const talkDelta = sliceNewSuffix(emittedTalk, split.talk);
        const tagThinkingDelta = sliceNewSuffix(
          emittedTagThinking,
          split.thinking
        );
        emittedTalk = split.talk;
        emittedTagThinking = split.thinking;
        const thinkingDelta = reasoningDelta + tagThinkingDelta;
        if (!talkDelta && !thinkingDelta) {
          continue;
        }
        fullText += talkDelta;
        fullThinking += thinkingDelta;
        yield {
          type: "delta",
          text: talkDelta,
          ...(thinkingDelta ? { thinking: thinkingDelta } : {}),
        };
      }
    }

    const toolCalls = toolAcc.filter(
      (call) => call.name.trim().length > 0 || call.arguments.trim().length > 0
    );
    const split = splitThinkTags(rawContent);
    fullText = split.talk;
    fullThinking = reasoningAcc + split.thinking;
    if (!fullText.trim() && !fullThinking.trim() && toolCalls.length === 0) {
      yield { type: "error", error: "Upstream stream returned no text" };
      return;
    }

    yield {
      type: "done",
      text: fullText,
      ...(fullThinking ? { thinking: fullThinking } : {}),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
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
