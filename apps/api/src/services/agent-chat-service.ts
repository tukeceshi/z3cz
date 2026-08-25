import type {
  AgentChatConversationBody,
  AgentChatDirectoryEntry,
} from "@dafthunk/types";
import {
  conversationHasMessages,
  fingerprintAgentChatBody,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import type { Database } from "../db";
import {
  deleteAgentConversation,
  getAgentConversation,
  insertAgentConversation,
  listAgentConversations,
  updateAgentConversation,
  type AgentConversationRow,
} from "../db/agent-conversation-queries";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { decryptSecret } from "../utils/encryption";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

const BODY_FILE = "conversation.json";

export function buildAgentChatCloudPath(params: {
  readonly prefix: string;
  readonly workflowId: string;
  readonly conversationId: string;
}): string {
  const root = params.prefix.replace(/\/$/, "") || "z3cz";
  return `${root}/workflows/wf_${params.workflowId}/agent-chat/${params.conversationId}/`;
}

function bodyKey(cloudPath: string): string {
  return `${cloudPath.replace(/\/$/, "")}/${BODY_FILE}`;
}

export function toDirectoryEntry(
  row: AgentConversationRow,
  userId: string
): AgentChatDirectoryEntry {
  const holderIsSelf = !row.sealed && row.holderUserId === userId;
  return {
    id: row.id,
    workflowId: row.workflowId,
    title: row.title,
    cloudPath: row.cloudPath,
    sealed: row.sealed,
    holderUserId: row.holderUserId,
    holderIsSelf,
    inUse: !row.sealed && !holderIsSelf,
    fingerprint: row.contentFingerprint,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function createOrgTosClient(
  env: Bindings,
  organizationId: string
): Promise<{
  readonly client: VolcengineTosClient;
  readonly prefix: string;
} | null> {
  const db = (await import("../db")).createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }
  const secretAccessKey = await decryptSecret(
    cloud.secretAccessKeyEncrypted,
    env,
    organizationId
  );
  return {
    client: new VolcengineTosClient({
      accessKeyId: cloud.accessKeyId,
      secretAccessKey,
      region: cloud.tosStorage.region,
      bucket: cloud.tosStorage.bucket,
    }),
    prefix: cloud.tosStorage.prefix || "z3cz",
  };
}

export async function isAgentChatCloudEnabled(
  db: Database,
  organizationId: string
): Promise<boolean> {
  return (await resolveOrgCloudStorage(db, organizationId)) !== null;
}

export async function writeAgentChatBody(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly cloudPath: string;
  readonly body: AgentChatConversationBody;
}): Promise<boolean> {
  const tos = await createOrgTosClient(params.env, params.organizationId);
  if (!tos) {
    return false;
  }
  const payload = JSON.stringify(params.body);
  await tos.client.putObject({
    key: bodyKey(params.cloudPath),
    body: new TextEncoder().encode(payload),
    mimeType: "application/json",
  });
  return true;
}

export async function readAgentChatBody(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly cloudPath: string;
}): Promise<AgentChatConversationBody | null> {
  const tos = await createOrgTosClient(params.env, params.organizationId);
  if (!tos) {
    return null;
  }
  try {
    const object = await tos.client.getObject({ key: bodyKey(params.cloudPath) });
    const text = new TextDecoder().decode(object.data);
    const parsed = JSON.parse(text) as AgentChatConversationBody;
    if (!parsed || !Array.isArray(parsed.messages)) {
      return { messages: [] };
    }
    return { messages: parsed.messages };
  } catch {
    return { messages: [] };
  }
}

export async function listAgentChatDirectory(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly userId: string;
}): Promise<{
  readonly conversations: readonly AgentChatDirectoryEntry[];
  readonly cloudEnabled: boolean;
}> {
  const cloudEnabled = await isAgentChatCloudEnabled(
    params.db,
    params.organizationId
  );
  if (!cloudEnabled) {
    return { conversations: [], cloudEnabled: false };
  }
  const rows = await listAgentConversations(params.db, {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  return {
    cloudEnabled: true,
    conversations: rows.map((row) => toDirectoryEntry(row, params.userId)),
  };
}

export async function switchAgentChat(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly userId: string;
  readonly workflowId: string;
  readonly currentConversationId?: string;
  readonly currentTitle?: string;
  readonly currentBody?: AgentChatConversationBody;
  readonly targetConversationId?: string;
}): Promise<
  | {
      readonly ok: true;
      readonly conversations: readonly AgentChatDirectoryEntry[];
      readonly current: AgentChatDirectoryEntry;
      readonly currentBody: AgentChatConversationBody | null;
      readonly cloudEnabled: boolean;
    }
  | {
      readonly ok: false;
      readonly inUse: true;
      readonly conversations: readonly AgentChatDirectoryEntry[];
      readonly cloudEnabled: boolean;
    }
> {
  const cloudEnabled = await isAgentChatCloudEnabled(
    params.db,
    params.organizationId
  );
  if (!cloudEnabled) {
    return {
      ok: true,
      cloudEnabled: false,
      conversations: [],
      current: {
        id: params.targetConversationId ?? crypto.randomUUID(),
        workflowId: params.workflowId,
        title: "",
        cloudPath: "",
        sealed: false,
        holderUserId: params.userId,
        holderIsSelf: true,
        inUse: false,
        fingerprint: "",
        updatedAt: new Date().toISOString(),
      },
      currentBody: null,
    };
  }

  const tos = await createOrgTosClient(params.env, params.organizationId);
  const prefix = tos?.prefix ?? "z3cz";

  if (params.targetConversationId) {
    const target = await getAgentConversation(params.db, {
      organizationId: params.organizationId,
      conversationId: params.targetConversationId,
    });
    if (
      target &&
      !target.sealed &&
      target.holderUserId &&
      target.holderUserId !== params.userId
    ) {
      const listed = await listAgentChatDirectory({
        db: params.db,
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        userId: params.userId,
      });
      return {
        ok: false,
        inUse: true,
        conversations: listed.conversations,
        cloudEnabled: true,
      };
    }
  }

  if (
    params.currentConversationId &&
    params.currentConversationId !== params.targetConversationId
  ) {
    const hasContent = conversationHasMessages(params.currentBody);
    if (!hasContent) {
      await deleteAgentConversation(params.db, {
        organizationId: params.organizationId,
        conversationId: params.currentConversationId,
      });
    } else {
      const current = await getAgentConversation(params.db, {
        organizationId: params.organizationId,
        conversationId: params.currentConversationId,
      });
      if (current) {
        await writeAgentChatBody({
          env: params.env,
          organizationId: params.organizationId,
          cloudPath: current.cloudPath,
          body: params.currentBody ?? { messages: [] },
        });
        await updateAgentConversation(params.db, {
          organizationId: params.organizationId,
          conversationId: current.id,
          title: params.currentTitle?.trim() || current.title,
          contentFingerprint: fingerprintAgentChatBody(params.currentBody),
          sealed: true,
          holderUserId: null,
        });
      }
    }
  }

  let currentRow: AgentConversationRow;
  if (params.targetConversationId) {
    const existing = await getAgentConversation(params.db, {
      organizationId: params.organizationId,
      conversationId: params.targetConversationId,
    });
    if (!existing) {
      currentRow = await insertAgentConversation(params.db, {
        id: params.targetConversationId,
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        title: "",
        cloudPath: buildAgentChatCloudPath({
          prefix,
          workflowId: params.workflowId,
          conversationId: params.targetConversationId,
        }),
        sealed: false,
        holderUserId: params.userId,
      });
    } else if (
      existing.sealed &&
      params.currentConversationId !== existing.id
    ) {
      currentRow = existing;
    } else {
      const updated = await updateAgentConversation(params.db, {
        organizationId: params.organizationId,
        conversationId: existing.id,
        sealed: false,
        holderUserId: params.userId,
      });
      currentRow = updated ?? existing;
    }
  } else {
    const id = crypto.randomUUID();
    currentRow = await insertAgentConversation(params.db, {
      id,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      title: "",
      cloudPath: buildAgentChatCloudPath({
        prefix,
        workflowId: params.workflowId,
        conversationId: id,
      }),
      sealed: false,
      holderUserId: params.userId,
    });
  }

  const listed = await listAgentChatDirectory({
    db: params.db,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    userId: params.userId,
  });
  const current = toDirectoryEntry(currentRow, params.userId);

  return {
    ok: true,
    cloudEnabled: true,
    conversations: listed.conversations,
    current,
    currentBody: null,
  };
}

export async function sealAgentChatConversation(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly userId: string;
  readonly conversationId: string;
}): Promise<
  | { readonly ok: true; readonly current: AgentChatDirectoryEntry }
  | { readonly ok: false; readonly error: string; readonly status: 404 }
> {
  const row = await getAgentConversation(params.db, {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
  });
  if (!row) {
    return { ok: false, error: "Conversation not found", status: 404 };
  }
  const updated = await updateAgentConversation(params.db, {
    organizationId: params.organizationId,
    conversationId: row.id,
    sealed: true,
    holderUserId: null,
  });
  const current = toDirectoryEntry(updated ?? row, params.userId);
  return { ok: true, current };
}

export async function putHeldAgentChatBody(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly title: string;
  readonly body: AgentChatConversationBody;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const row = await getAgentConversation(params.db, {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
  });
  if (!row) {
    return { ok: false, error: "Conversation not found" };
  }
  if (row.sealed || row.holderUserId !== params.userId) {
    return { ok: false, error: "Conversation is not held by this user" };
  }
  if (!conversationHasMessages(params.body)) {
    return { ok: true };
  }
  await writeAgentChatBody({
    env: params.env,
    organizationId: params.organizationId,
    cloudPath: row.cloudPath,
    body: params.body,
  });
  await updateAgentConversation(params.db, {
    organizationId: params.organizationId,
    conversationId: row.id,
    title: params.title.trim() || row.title,
    contentFingerprint: fingerprintAgentChatBody(params.body),
  });
  return { ok: true };
}

export async function getAllowedAgentChatBody(params: {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly userId: string;
  readonly conversationId: string;
}): Promise<
  | { readonly ok: true; readonly body: AgentChatConversationBody }
  | { readonly ok: false; readonly error: string; readonly status: 403 | 404 }
> {
  const row = await getAgentConversation(params.db, {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
  });
  if (!row) {
    return { ok: false, error: "Conversation not found", status: 404 };
  }
  const holderIsSelf = !row.sealed && row.holderUserId === params.userId;
  if (!row.sealed && !holderIsSelf) {
    return { ok: false, error: "Conversation is in use", status: 403 };
  }
  const body = await readAgentChatBody({
    env: params.env,
    organizationId: params.organizationId,
    cloudPath: row.cloudPath,
  });
  return { ok: true, body: body ?? { messages: [] } };
}
