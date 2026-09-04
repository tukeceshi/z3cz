import type {
  AgentChatConversationBody,
  AgentChatMessage,
} from "@dafthunk/types";

import { cacheMediaFromBlob } from "@/services/ai-media-cache-service";
import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";
import type { AgentSessionMode } from "@/services/agent-session-mode";

const DB_NAME = "dafthunk-agent-chats";
const DB_VERSION = 1;
const STORE = "conversations";
const META_STORE = "meta";

export interface LocalAgentConversation {
  readonly id: string;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly title: string;
  readonly messages: readonly AgentChatMessage[];
  readonly updatedAt: string;
  readonly activeInvocationId?: string;
  readonly sessionMode?: AgentSessionMode;
  readonly planDocument?: string;
  readonly planPending?: boolean;
  readonly consentedCapabilities?: readonly string[];
}

function conversationKey(
  organizationId: string,
  workflowId: string,
  conversationId: string
): string {
  return `${organizationId}:${workflowId}:${conversationId}`;
}

function lastOpenKey(organizationId: string, workflowId: string): string {
  return `lastOpen:${organizationId}:${workflowId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

interface StoredConversation extends LocalAgentConversation {
  readonly key: string;
}

export async function listLocalAgentConversations(params: {
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<readonly LocalAgentConversation[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readonly");
  const rows = await idbRequest<StoredConversation[]>(
    tx.objectStore(STORE).getAll()
  );
  db.close();
  return rows
    .filter(
      (row) =>
        row.organizationId === params.organizationId &&
        row.workflowId === params.workflowId
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readLocalAgentConversation(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly conversationId: string;
}): Promise<LocalAgentConversation | null> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readonly");
  const row = await idbRequest<StoredConversation | undefined>(
    tx
      .objectStore(STORE)
      .get(
        conversationKey(
          params.organizationId,
          params.workflowId,
          params.conversationId
        )
      )
  );
  db.close();
  return row ?? null;
}

export async function writeLocalAgentConversation(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly conversation: LocalAgentConversation;
}): Promise<void> {
  const stored: StoredConversation = {
    ...params.conversation,
    key: conversationKey(
      params.organizationId,
      params.workflowId,
      params.conversation.id
    ),
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  await idbRequest(tx.objectStore(STORE).put(stored));
  db.close();

  if (!params.conversation.messages.some((message) => message.content.trim())) {
    return;
  }

  const body: AgentChatConversationBody = {
    messages: params.conversation.messages,
  };
  await cacheMediaFromBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    mediaId: params.conversation.id,
    blob: new Blob([JSON.stringify(body)], { type: "application/json" }),
    mimeType: "application/json",
    nodeType: "agent-chat",
  });
  notifyAiMediaCacheChanged();
}

export async function deleteLocalAgentConversation(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly conversationId: string;
}): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  await idbRequest(
    tx
      .objectStore(STORE)
      .delete(
        conversationKey(
          params.organizationId,
          params.workflowId,
          params.conversationId
        )
      )
  );
  db.close();
}

export async function readLastOpenAgentConversationId(params: {
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<string | null> {
  const db = await openDatabase();
  const tx = db.transaction(META_STORE, "readonly");
  const row = await idbRequest<{ key: string; value: string } | undefined>(
    tx
      .objectStore(META_STORE)
      .get(lastOpenKey(params.organizationId, params.workflowId))
  );
  db.close();
  return row?.value ?? null;
}

export async function writeLastOpenAgentConversationId(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly conversationId: string;
}): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(META_STORE, "readwrite");
  await idbRequest(
    tx.objectStore(META_STORE).put({
      key: lastOpenKey(params.organizationId, params.workflowId),
      value: params.conversationId,
    })
  );
  db.close();
}

export function createEmptyLocalConversation(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly id?: string;
}): LocalAgentConversation {
  return {
    id: params.id ?? crypto.randomUUID(),
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    title: "",
    messages: [],
    updatedAt: new Date().toISOString(),
    sessionMode: "ask",
  };
}
