import { and, desc, eq } from "drizzle-orm";

import type { Database } from "./index";
import { agentConversations } from "./schema";

export interface AgentConversationRow {
  readonly id: string;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly title: string;
  readonly cloudPath: string;
  readonly contentFingerprint: string;
  readonly sealed: boolean;
  readonly holderUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function mapRow(
  row: typeof agentConversations.$inferSelect
): AgentConversationRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workflowId: row.workflowId,
    title: row.title,
    cloudPath: row.cloudPath,
    contentFingerprint: row.contentFingerprint,
    sealed: row.sealed,
    holderUserId: row.holderUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAgentConversations(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly workflowId: string;
  }
): Promise<readonly AgentConversationRow[]> {
  const rows = await db
    .select()
    .from(agentConversations)
    .where(
      and(
        eq(agentConversations.organizationId, params.organizationId),
        eq(agentConversations.workflowId, params.workflowId)
      )
    )
    .orderBy(desc(agentConversations.updatedAt));
  return rows.map(mapRow);
}

export async function getAgentConversation(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly conversationId: string;
  }
): Promise<AgentConversationRow | null> {
  const rows = await db
    .select()
    .from(agentConversations)
    .where(
      and(
        eq(agentConversations.id, params.conversationId),
        eq(agentConversations.organizationId, params.organizationId)
      )
    )
    .limit(1);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function insertAgentConversation(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly workflowId: string;
    readonly title: string;
    readonly cloudPath: string;
    readonly contentFingerprint?: string;
    readonly sealed: boolean;
    readonly holderUserId: string | null;
  }
): Promise<AgentConversationRow> {
  const [row] = await db
    .insert(agentConversations)
    .values({
      id: params.id,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      title: params.title,
      cloudPath: params.cloudPath,
      contentFingerprint: params.contentFingerprint ?? "",
      sealed: params.sealed,
      holderUserId: params.holderUserId,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to insert agent conversation");
  }
  return mapRow(row);
}

export async function updateAgentConversation(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly conversationId: string;
    readonly title?: string;
    readonly contentFingerprint?: string;
    readonly sealed?: boolean;
    readonly holderUserId?: string | null;
  }
): Promise<AgentConversationRow | null> {
  const [row] = await db
    .update(agentConversations)
    .set({
      ...(params.title !== undefined ? { title: params.title } : {}),
      ...(params.contentFingerprint !== undefined
        ? { contentFingerprint: params.contentFingerprint }
        : {}),
      ...(params.sealed !== undefined ? { sealed: params.sealed } : {}),
      ...(params.holderUserId !== undefined
        ? { holderUserId: params.holderUserId }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agentConversations.id, params.conversationId),
        eq(agentConversations.organizationId, params.organizationId)
      )
    )
    .returning();
  return row ? mapRow(row) : null;
}

export async function deleteAgentConversation(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly conversationId: string;
  }
): Promise<void> {
  await db
    .delete(agentConversations)
    .where(
      and(
        eq(agentConversations.id, params.conversationId),
        eq(agentConversations.organizationId, params.organizationId)
      )
    );
}
