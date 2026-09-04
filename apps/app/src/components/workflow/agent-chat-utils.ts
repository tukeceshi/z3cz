import type {
  AgentChatAnswer,
  AgentChatMessage,
  OrgTextModelOption,
} from "@dafthunk/types";
import {
  contextWindowTokensForCanonicalId,
  mergeAgentChatAnswers,
} from "@dafthunk/types";

import { parseSavedAnswer } from "@/services/agent-chat-scheduler";

export const AGENT_CHAT_AUTO_ID = "auto" as const;

export function estimateAgentChatTokens(text: string): number {
  return Math.max(1, text.length);
}

export function trimMessagesForContext<
  T extends { readonly role: string; readonly content: string },
>(params: {
  readonly messages: readonly T[];
  readonly contextWindowTokens: number;
  readonly outputMaxTokens: number;
}): readonly T[] {
  const budget = Math.max(
    1,
    params.contextWindowTokens - Math.max(0, params.outputMaxTokens)
  );
  const pinned = params.messages.filter((message) => message.role === "system");
  const rest = params.messages.filter((message) => message.role !== "system");
  if (rest.length === 0) {
    return pinned;
  }

  const messages = [...rest];
  const totalTokens = (): number =>
    pinned.reduce(
      (sum, message) => sum + estimateAgentChatTokens(message.content),
      0
    ) +
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
      return pinned;
    }
    const keep = Math.max(1, budget);
    return [
      ...pinned,
      {
        ...last,
        content: last.content.slice(-keep),
      },
    ];
  }

  return [...pinned, ...messages];
}

export function selectableTextModelsInOrder(
  models: readonly OrgTextModelOption[]
): readonly OrgTextModelOption[] {
  return [...models]
    .filter((model) => model.selectable)
    .sort(
      (a, b) =>
        Number(b.usesOfficialUrl) - Number(a.usesOfficialUrl) ||
        a.sortOrder - b.sortOrder ||
        a.displayName.localeCompare(b.displayName)
    );
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
  readonly send: AgentChatMessage;
  readonly sendIndex: number;
  readonly assistantId: string | undefined;
  readonly answer: AgentChatAnswer;
  readonly executed: boolean;
  readonly hasReply: boolean;
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
    const assistants: AgentChatMessage[] = [];
    let nextIndex = index + 1;
    while (nextIndex < messages.length) {
      const next = messages[nextIndex];
      if (!next || next.role !== "assistant") {
        break;
      }
      assistants.push(next);
      nextIndex += 1;
    }
    const answers = assistants.map((assistant) =>
      parseSavedAnswer(assistant.content)
    );
    const answer = mergeAgentChatAnswers(answers);
    turns.push({
      send: message,
      sendIndex: index,
      assistantId: assistants[0]?.id,
      answer,
      executed:
        assistants.length > 1 ||
        answer.tools.some((tool) => tool.name.trim().length > 0),
      hasReply: assistants.length > 0,
    });
  }
  return turns;
}

export function isAgentThinkingLive(params: {
  readonly streaming: boolean;
  readonly hasTalk: boolean;
  readonly hasTools: boolean;
}): boolean {
  return params.streaming && !params.hasTalk && !params.hasTools;
}

export function executeTraceTitle(answer: AgentChatAnswer): string {
  return answer.talk.trim();
}

export function shouldShowExecuteTrace(hasReply: boolean): boolean {
  return hasReply;
}

export function turnHasCompletedExecute(executed: boolean): boolean {
  return executed;
}

export function answerHasProcess(answer: AgentChatAnswer): boolean {
  return (
    answer.thinking.trim().length > 0 ||
    answer.tools.some(
      (tool) =>
        tool.name.trim().length > 0 || tool.result.trim().length > 0
    )
  );
}

export function shouldWrapAgentWorked(params: {
  readonly streaming: boolean;
  readonly hasThinking: boolean;
  readonly hasTools: boolean;
}): boolean {
  return !params.streaming && (params.hasThinking || params.hasTools);
}
