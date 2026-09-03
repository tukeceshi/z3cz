import type { AgentChatMessage, OrgTextModelOption } from "@dafthunk/types";
import { contextWindowTokensForCanonicalId } from "@dafthunk/types";

import { sortModelsForPicker } from "./ai-text-model-picker";

export const AGENT_CHAT_AUTO_ID = "auto" as const;

export function estimateAgentChatTokens(text: string): number {
  return Math.max(1, text.length);
}

export function trimMessagesForContext(params: {
  readonly messages: readonly AgentChatMessage[];
  readonly contextWindowTokens: number;
  readonly outputMaxTokens: number;
}): readonly AgentChatMessage[] {
  const budget = Math.max(
    1,
    params.contextWindowTokens - Math.max(0, params.outputMaxTokens)
  );
  const messages = [...params.messages];
  if (messages.length === 0) {
    return messages;
  }

  const totalTokens = (): number =>
    messages.reduce(
      (sum, message) => sum + estimateAgentChatTokens(message.content),
      0
    );

  while (messages.length > 1 && totalTokens() > budget) {
    messages.shift();
  }

  if (totalTokens() > budget) {
    const last = messages[messages.length - 1];
    if (!last) {
      return [];
    }
    const keep = Math.max(1, budget);
    return [
      {
        ...last,
        content: last.content.slice(-keep),
      },
    ];
  }

  return messages;
}

export function selectableTextModelsInOrder(
  models: readonly OrgTextModelOption[]
): readonly OrgTextModelOption[] {
  return sortModelsForPicker(models).filter((model) => model.selectable);
}

export function contextLimitForModel(model: OrgTextModelOption): {
  readonly contextWindowTokens: number;
  readonly outputMaxTokens: number;
} {
  return {
    contextWindowTokens: contextWindowTokensForCanonicalId(
      model.canonicalId,
      model.parameterRules.contextWindowTokens
    ),
    outputMaxTokens: model.parameterRules.outputMaxTokens,
  };
}

export type AgentContextUsageTone = "normal" | "warn" | "full";

export interface AgentContextUsage {
  readonly used: number;
  readonly limit: number;
  readonly ratio: number;
  readonly tone: AgentContextUsageTone;
}

export function resolveAgentContextModel(
  modelId: string,
  selectableModels: readonly OrgTextModelOption[]
): OrgTextModelOption | null {
  if (modelId !== AGENT_CHAT_AUTO_ID) {
    const selected = selectableModels.find(
      (model) => model.optionId === modelId
    );
    if (selected) {
      return selected;
    }
  }
  return selectableModels[0] ?? null;
}

export function estimateAgentContextUsedTokens(
  messages: readonly Pick<AgentChatMessage, "content">[],
  draft: string
): number {
  let used = 0;
  for (const message of messages) {
    if (message.content.length > 0) {
      used += estimateAgentChatTokens(message.content);
    }
  }
  if (draft.length > 0) {
    used += estimateAgentChatTokens(draft);
  }
  return used;
}

export function agentContextUsage(params: {
  readonly used: number;
  readonly limit: number;
}): AgentContextUsage {
  const used = Math.max(0, Math.round(params.used));
  const limit = Math.max(0, Math.round(params.limit));
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const tone: AgentContextUsageTone =
    ratio >= 0.9 ? "full" : ratio >= 0.7 ? "warn" : "normal";
  return { used, limit, ratio, tone };
}

export function formatAgentContextTokenCount(value: number): string {
  const count = Math.max(0, Math.round(value));
  if (count >= 1_000_000) {
    return formatCompactTokenCount(count / 1_000_000, "m");
  }
  if (count >= 1000) {
    return formatCompactTokenCount(count / 1000, "k");
  }
  return String(count);
}

function formatCompactTokenCount(scaled: number, suffix: "k" | "m"): string {
  const rounded = Math.round(scaled * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${suffix}`;
}

export function shouldFetchSealedAgentChatBody(params: {
  readonly sealed: boolean;
  readonly remoteFingerprint: string;
  readonly localFingerprint: string;
}): boolean {
  if (!params.sealed) {
    return false;
  }
  if (!params.localFingerprint) {
    return true;
  }
  return params.localFingerprint !== params.remoteFingerprint;
}

export function shouldSubmitAgentChatOnEnter(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
}): boolean {
  if (event.key !== "Enter" || event.shiftKey) {
    return false;
  }
  if (event.isComposing || event.keyCode === 229) {
    return false;
  }
  return true;
}

export interface AgentChatTurn {
  readonly user: AgentChatMessage;
  readonly userIndex: number;
  readonly assistant: AgentChatMessage | null;
}

export function groupAgentChatTurns(
  messages: readonly AgentChatMessage[]
): readonly AgentChatTurn[] {
  const turns: AgentChatTurn[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || message.role !== "user") {
      continue;
    }
    const next = messages[index + 1];
    turns.push({
      user: message,
      userIndex: index,
      assistant: next?.role === "assistant" ? next : null,
    });
  }
  return turns;
}
