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
