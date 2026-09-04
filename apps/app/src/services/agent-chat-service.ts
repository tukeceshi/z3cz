import type {
  AgentChatConversationBody,
  AgentChatDirectoryEntry,
  AgentChatStreamEvent,
  GetAgentChatBodyResponse,
  ListAgentChatsResponse,
  PutAgentChatBodyRequest,
  StopAgentChatResponse,
  SwitchAgentChatRequest,
  SwitchAgentChatResponse,
} from "@dafthunk/types";

import { buildApiUrl } from "@/config/api";
import { ApiRequestError, makeRequest } from "@/services/utils";

function agentChatEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

export async function listAgentChats(
  organizationId: string,
  workflowId: string
): Promise<ListAgentChatsResponse> {
  const query = new URLSearchParams({ workflowId });
  return makeRequest<ListAgentChatsResponse>(
    `${agentChatEndpoint(organizationId)}/agent-chats?${query.toString()}`
  );
}

export async function switchAgentChat(
  organizationId: string,
  body: SwitchAgentChatRequest
): Promise<SwitchAgentChatResponse> {
  try {
    return await makeRequest<SwitchAgentChatResponse>(
      `${agentChatEndpoint(organizationId)}/agent-chats/switch`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 409) {
      const listed = await listAgentChats(organizationId, body.workflowId);
      const currentId = body.targetConversationId ?? "";
      const current =
        listed.conversations.find((entry) => entry.id === currentId) ??
        listed.conversations[0];
      if (!current) {
        throw error;
      }
      return {
        conversations: listed.conversations,
        current,
        currentBody: null,
        cloudEnabled: listed.cloudEnabled,
        inUse: true,
      };
    }
    throw error;
  }
}

export async function sealAgentChat(
  organizationId: string,
  conversationId: string
): Promise<{ readonly current: AgentChatDirectoryEntry }> {
  return makeRequest<{ readonly current: AgentChatDirectoryEntry }>(
    `${agentChatEndpoint(organizationId)}/agent-chats/${encodeURIComponent(conversationId)}/seal`,
    { method: "POST" }
  );
}

export async function getAgentChatBody(
  organizationId: string,
  conversationId: string
): Promise<GetAgentChatBodyResponse> {
  return makeRequest<GetAgentChatBodyResponse>(
    `${agentChatEndpoint(organizationId)}/agent-chats/${encodeURIComponent(conversationId)}/body`
  );
}

export async function putAgentChatBody(
  organizationId: string,
  conversationId: string,
  body: PutAgentChatBodyRequest
): Promise<void> {
  await makeRequest(
    `${agentChatEndpoint(organizationId)}/agent-chats/${encodeURIComponent(conversationId)}/body`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

export interface StreamAgentChatHandlers {
  readonly onDelta?: (delta: string, fullText: string) => void;
  readonly onStarted?: (invocationId: string) => void;
  readonly signal?: AbortSignal;
}

export interface StreamAgentChatResult {
  readonly text: string;
  readonly aiInterfaceId: string;
  readonly invocationId: string;
  readonly stopped: boolean;
}

export class AgentChatStreamDisconnectedError extends Error {
  readonly invocationId: string;
  readonly text: string;

  constructor(invocationId: string, text: string) {
    super("Stream disconnected");
    this.name = "AgentChatStreamDisconnectedError";
    this.invocationId = invocationId;
    this.text = text;
  }
}

export function isAgentChatStreamDisconnectedError(
  error: { readonly name?: string } | null | undefined
): error is AgentChatStreamDisconnectedError {
  return error instanceof AgentChatStreamDisconnectedError;
}

interface StreamReadState {
  fullText: string;
  aiInterfaceId: string;
  invocationId: string;
  stopped: boolean;
  terminal: boolean;
  streamError: string | null;
}

function applyAgentChatStreamEvent(
  event: AgentChatStreamEvent,
  state: StreamReadState,
  handlers: StreamAgentChatHandlers
): void {
  if (event.type === "started") {
    state.invocationId = event.invocationId;
    handlers.onStarted?.(event.invocationId);
    return;
  }
  if (event.type === "snapshot") {
    state.fullText = event.text;
    state.invocationId = event.invocationId;
    handlers.onStarted?.(event.invocationId);
    handlers.onDelta?.("", state.fullText);
    return;
  }
  if (event.type === "delta") {
    state.fullText += event.text;
    handlers.onDelta?.(event.text, state.fullText);
    return;
  }
  if (event.type === "done") {
    state.fullText = event.text;
    state.aiInterfaceId = event.aiInterfaceId;
    state.invocationId = event.invocationId;
    state.terminal = true;
    handlers.onDelta?.("", state.fullText);
    return;
  }
  if (event.type === "stopped") {
    state.fullText = event.text;
    state.invocationId = event.invocationId;
    state.stopped = true;
    state.terminal = true;
    handlers.onDelta?.("", state.fullText);
    return;
  }
  state.streamError = event.error;
  state.terminal = true;
}

async function readFailedResponse(response: Response): Promise<string> {
  let message = `Request failed with status: ${response.status}`;
  try {
    const errorData = (await response.json()) as { error?: string };
    if (errorData.error) {
      message = errorData.error;
    }
  } catch {
    // keep status message
  }
  return message;
}

async function readAgentChatSse(
  response: Response,
  handlers: StreamAgentChatHandlers,
  initial: { readonly aiInterfaceId: string; readonly invocationId?: string }
): Promise<StreamAgentChatResult> {
  if (!response.body) {
    throw new Error("No stream body from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const state: StreamReadState = {
    fullText: "",
    aiInterfaceId: initial.aiInterfaceId,
    invocationId: initial.invocationId ?? "",
    stopped: false,
    terminal: false,
    streamError: null,
  };

  const throwIfAborted = (): void => {
    if (!handlers.signal?.aborted) {
      return;
    }
    throw new DOMException("The user aborted a request.", "AbortError");
  };

  while (true) {
    throwIfAborted();
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith("data:"));
      if (!line) {
        continue;
      }
      const data = line.slice(5).trim();
      if (!data) {
        continue;
      }
      let event: AgentChatStreamEvent;
      try {
        event = JSON.parse(data) as AgentChatStreamEvent;
      } catch {
        continue;
      }
      applyAgentChatStreamEvent(event, state, handlers);
    }
    if (state.terminal) {
      break;
    }
  }

  if (state.streamError) {
    throw new Error(state.streamError);
  }
  if (state.terminal) {
    return {
      text: state.fullText,
      aiInterfaceId: state.aiInterfaceId,
      invocationId: state.invocationId,
      stopped: state.stopped,
    };
  }
  if (state.invocationId) {
    throw new AgentChatStreamDisconnectedError(
      state.invocationId,
      state.fullText
    );
  }
  throw new Error("Stream returned no text");
}

export async function streamAgentChat(
  organizationId: string,
  body: {
    readonly modelCanonicalId: string;
    readonly aiInterfaceId: string;
    readonly messages: readonly {
      readonly role: "user" | "assistant" | "system";
      readonly content: string;
    }[];
    readonly workflowId?: string;
  },
  handlers: StreamAgentChatHandlers = {}
): Promise<StreamAgentChatResult> {
  const fullUrl = buildApiUrl(
    `${agentChatEndpoint(organizationId)}/agent-chat/generate-stream`
  );

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!response.ok) {
    throw new Error(await readFailedResponse(response));
  }

  return readAgentChatSse(response, handlers, {
    aiInterfaceId: body.aiInterfaceId,
  });
}

export async function resumeAgentChatStream(
  organizationId: string,
  invocationId: string,
  handlers: StreamAgentChatHandlers = {}
): Promise<StreamAgentChatResult> {
  const fullUrl = buildApiUrl(
    `${agentChatEndpoint(organizationId)}/agent-chat/generate-stream/${encodeURIComponent(invocationId)}`
  );

  const response = await fetch(fullUrl, {
    method: "GET",
    credentials: "include",
    signal: handlers.signal,
  });

  if (!response.ok) {
    throw new Error(await readFailedResponse(response));
  }

  return readAgentChatSse(response, handlers, {
    aiInterfaceId: "",
    invocationId,
  });
}

export async function stopAgentChatStream(
  organizationId: string,
  invocationId: string
): Promise<StopAgentChatResponse> {
  return makeRequest<StopAgentChatResponse>(
    `${agentChatEndpoint(organizationId)}/agent-chat/generate-stream/${encodeURIComponent(invocationId)}/stop`,
    { method: "POST" }
  );
}

export function conversationBodyFromMessages(
  messages: AgentChatConversationBody["messages"]
): AgentChatConversationBody {
  return { messages };
}
