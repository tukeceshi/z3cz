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

export interface AgentChatThinkBlock {
  readonly kind: "think";
  readonly text: string;
}

export interface AgentChatTalkBlock {
  readonly kind: "talk";
  readonly text: string;
}

export interface AgentChatToolBlock {
  readonly kind: "tool";
  readonly tool: AgentChatToolCall;
}

export type AgentChatBlock =
  | AgentChatThinkBlock
  | AgentChatTalkBlock
  | AgentChatToolBlock;

export interface AgentChatAnswer {
  readonly blocks?: readonly AgentChatBlock[];
  readonly thinking: string;
  readonly tools: readonly AgentChatToolCall[];
  readonly talk: string;
}

function blocksFromBuckets(answer: AgentChatAnswer): AgentChatBlock[] {
  const blocks: AgentChatBlock[] = [];
  if (answer.thinking.trim()) {
    blocks.push({ kind: "think", text: answer.thinking.trim() });
  }
  for (const tool of answer.tools) {
    blocks.push({ kind: "tool", tool });
  }
  if (answer.talk.trim()) {
    blocks.push({ kind: "talk", text: answer.talk.trim() });
  }
  return blocks;
}

export function answerBlocks(
  answer: AgentChatAnswer
): readonly AgentChatBlock[] {
  return answer.blocks ?? blocksFromBuckets(answer);
}

export function answerFromBlocks(
  blocks: readonly AgentChatBlock[]
): AgentChatAnswer {
  const kept = blocks.filter(
    (block) => block.kind === "tool" || block.text.trim().length > 0
  );
  const thinkingParts: string[] = [];
  const tools: AgentChatToolCall[] = [];
  const talkParts: string[] = [];
  for (const block of kept) {
    if (block.kind === "think") {
      thinkingParts.push(block.text.trim());
    } else if (block.kind === "tool") {
      tools.push(block.tool);
    } else {
      talkParts.push(block.text.trim());
    }
  }
  return {
    blocks: kept,
    thinking: thinkingParts.join("\n"),
    tools,
    talk: talkParts.join("\n"),
  };
}

export function withAnswerStep(
  committed: AgentChatAnswer,
  thinking: string,
  talk: string
): AgentChatAnswer {
  const blocks = [...answerBlocks(committed)];
  const nextThink = thinking.trim();
  const nextTalk = talk.trim();
  if (nextThink) {
    blocks.push({ kind: "think", text: nextThink });
  }
  if (nextTalk) {
    blocks.push({ kind: "talk", text: nextTalk });
  }
  return answerFromBlocks(blocks);
}

export function withAnswerStepIfNew(
  committed: AgentChatAnswer,
  thinking: string,
  talk: string
): AgentChatAnswer {
  const nextThink = thinking.trim();
  const nextTalk = talk.trim();
  const existingThink = committed.thinking.trim();
  const existingTalk = committed.talk.trim();
  const skipThink =
    !nextThink ||
    nextThink === existingThink ||
    (existingThink.length > 0 &&
      (existingThink.includes(nextThink) || nextThink.includes(existingThink)));
  const skipTalk =
    !nextTalk ||
    nextTalk === existingTalk ||
    (existingTalk.length > 0 &&
      (existingTalk.includes(nextTalk) || nextTalk.includes(existingTalk)));
  if (skipThink && skipTalk) {
    return committed;
  }
  return withAnswerStep(
    committed,
    skipThink ? "" : nextThink,
    skipTalk ? "" : nextTalk
  );
}

export function appendAnswerTool(
  answer: AgentChatAnswer,
  tool: AgentChatToolCall
): AgentChatAnswer {
  return answerFromBlocks([...answerBlocks(answer), { kind: "tool", tool }]);
}

export function replaceLastAnswerTool(
  answer: AgentChatAnswer,
  tool: AgentChatToolCall
): AgentChatAnswer {
  const blocks = [...answerBlocks(answer)];
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block?.kind === "tool") {
      blocks[index] = { kind: "tool", tool };
      return answerFromBlocks(blocks);
    }
  }
  return appendAnswerTool(answer, tool);
}

export function dropUnfinishedAnswerTool(
  answer: AgentChatAnswer
): AgentChatAnswer {
  const blocks = [...answerBlocks(answer)];
  const last = blocks[blocks.length - 1];
  if (last?.kind === "tool" && !last.tool.result.trim()) {
    return answerFromBlocks(blocks.slice(0, -1));
  }
  return answerFromBlocks(blocks);
}

export function fillLastAnswerToolResult(
  answer: AgentChatAnswer,
  result: string
): AgentChatAnswer {
  const blocks = [...answerBlocks(answer)];
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block?.kind === "tool") {
      if (block.tool.result.trim()) {
        return answerFromBlocks(blocks);
      }
      blocks[index] = { kind: "tool", tool: { ...block.tool, result } };
      return answerFromBlocks(blocks);
    }
  }
  return answerFromBlocks(blocks);
}

export function emptyAgentChatAnswer(): AgentChatAnswer {
  return answerFromBlocks([]);
}

export function agentChatAnswerIsEmpty(answer: AgentChatAnswer): boolean {
  return answerBlocks(answer).length === 0;
}

export function mergeAgentChatAnswers(
  answers: readonly AgentChatAnswer[]
): AgentChatAnswer {
  return answerFromBlocks(answers.flatMap((answer) => answerBlocks(answer)));
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

export interface AgentChatStreamToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface AgentChatStreamMessage {
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly AgentChatStreamToolCall[];
}

export interface AgentChatStreamTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: unknown;
  };
}

export interface AgentChatStreamRequest {
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly messages: readonly AgentChatStreamMessage[];
  readonly tools?: readonly AgentChatStreamTool[];
  readonly workflowId?: string;
}

export type AgentChatStreamEvent =
  | { readonly type: "started"; readonly invocationId: string }
  | {
      readonly type: "snapshot";
      readonly text: string;
      readonly thinking?: string;
      readonly invocationId: string;
    }
  | { readonly type: "delta"; readonly text: string; readonly thinking?: string }
  | {
      readonly type: "done";
      readonly text: string;
      readonly thinking?: string;
      readonly toolCalls?: readonly AgentChatStreamToolCall[];
      readonly invocationId: string;
      readonly aiInterfaceId: string;
    }
  | {
      readonly type: "stopped";
      readonly text: string;
      readonly thinking?: string;
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
