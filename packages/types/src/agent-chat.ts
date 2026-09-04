export interface AgentChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface AgentChatToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly result: string;
}

export interface AgentChatAnswer {
  readonly thinking: string;
  readonly tools: readonly AgentChatToolCall[];
  readonly talk: string;
}

export function emptyAgentChatAnswer(): AgentChatAnswer {
  return { thinking: "", tools: [], talk: "" };
}

export function agentChatAnswerIsEmpty(answer: AgentChatAnswer): boolean {
  return (
    answer.thinking.trim().length === 0 &&
    answer.tools.length === 0 &&
    answer.talk.trim().length === 0
  );
}

export function mergeAgentChatAnswers(
  answers: readonly AgentChatAnswer[]
): AgentChatAnswer {
  const thinkingParts: string[] = [];
  const tools: AgentChatToolCall[] = [];
  let talk = "";
  for (const answer of answers) {
    const thinking = answer.thinking.trim();
    if (thinking) {
      thinkingParts.push(thinking);
    }
    tools.push(...answer.tools);
    const nextTalk = answer.talk.trim();
    if (nextTalk) {
      talk = nextTalk;
    }
  }
  return {
    thinking: thinkingParts.join("\n"),
    tools,
    talk,
  };
}

export interface AgentChatConversationBody {
  readonly messages: readonly AgentChatMessage[];
}

export interface AgentChatDirectoryEntry {
  readonly id: string;
  readonly workflowId: string;
  readonly title: string;
  readonly cloudPath: string;
  readonly sealed: boolean;
  readonly holderUserId: string | null;
  readonly holderIsSelf: boolean;
  readonly inUse: boolean;
  readonly fingerprint: string;
  readonly updatedAt: string;
}

export interface ListAgentChatsResponse {
  readonly conversations: readonly AgentChatDirectoryEntry[];
  readonly cloudEnabled: boolean;
}

export interface SwitchAgentChatRequest {
  readonly workflowId: string;
  readonly currentConversationId?: string;
  readonly currentTitle?: string;
  readonly currentBody?: AgentChatConversationBody;
  readonly targetConversationId?: string;
}

export interface SwitchAgentChatResponse {
  readonly conversations: readonly AgentChatDirectoryEntry[];
  readonly current: AgentChatDirectoryEntry;
  readonly currentBody: AgentChatConversationBody | null;
  readonly cloudEnabled: boolean;
  readonly inUse: boolean;
}

export interface PutAgentChatBodyRequest {
  readonly workflowId: string;
  readonly title: string;
  readonly body: AgentChatConversationBody;
}

export interface GetAgentChatBodyResponse {
  readonly body: AgentChatConversationBody;
}

export interface AgentChatStreamMessage {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
}

export interface AgentChatStreamRequest {
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly messages: readonly AgentChatStreamMessage[];
  readonly workflowId?: string;
}

export type AgentChatStreamEvent =
  | { readonly type: "started"; readonly invocationId: string }
  | {
      readonly type: "snapshot";
      readonly text: string;
      readonly invocationId: string;
    }
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "done";
      readonly text: string;
      readonly invocationId: string;
      readonly aiInterfaceId: string;
    }
  | {
      readonly type: "stopped";
      readonly text: string;
      readonly invocationId: string;
    }
  | { readonly type: "error"; readonly error: string };

export interface StopAgentChatResponse {
  readonly text: string;
}

export function conversationHasMessages(
  body: AgentChatConversationBody | undefined
): boolean {
  return (body?.messages ?? []).some(
    (message) => message.content.trim().length > 0
  );
}

export function fingerprintAgentChatBody(
  body: AgentChatConversationBody | undefined
): string {
  const canonical = JSON.stringify(
    (body?.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }))
  );
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function titleFromMessages(
  messages: readonly AgentChatMessage[],
  fallback = ""
): string {
  const firstUser = messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0
  );
  if (!firstUser) {
    return fallback;
  }
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
