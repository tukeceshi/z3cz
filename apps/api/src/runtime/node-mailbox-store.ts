import { v7 as uuidv7 } from "uuid";

import { normalizeSubject } from "../support-utils";
import type {
  IngestInboundArgs,
  InsertOutboundArgs,
  MailboxAttachmentRow,
  MailboxMessageRow,
  MailboxThreadRow,
} from "../durable-objects/mailbox-do";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface ThreadRecord {
  id: string;
  emailId: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  archivedAt: number | null;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
  agentRunId: string | null;
}

interface MessageRecord {
  id: string;
  threadId: string;
  emailId: string;
  direction: "inbound" | "outbound";
  rfc822MessageId: string;
  inReplyTo: string | null;
  referencesChain: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string;
  snippet: string;
  hasHtml: boolean;
  hasText: boolean;
  attachmentCount: number;
  rawR2Key: string;
  createdAt: number;
}

interface AttachmentRecord {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  r2Key: string;
  contentId: string | null;
}

/**
 * In-memory mailbox index for the Node runtime.
 * Mirrors {@link MailboxDO} semantics without Durable Object SQLite.
 */
export class MailboxStore {
  private readonly threads = new Map<string, ThreadRecord>();
  private readonly messages = new Map<string, MessageRecord>();
  private readonly attachments = new Map<string, AttachmentRecord>();

  async ingestInbound(args: IngestInboundArgs): Promise<{
    threadId: string;
    messageId: string;
    agentRunId: string | null;
  }> {
    const now = Date.now();
    const threadId = this.resolveThread(args) ?? this.createThread(args, now);

    const thread = this.threads.get(threadId);
    if (thread) {
      thread.lastMessageAt = now;
      thread.archivedAt = null;
      thread.updatedAt = now;
    }

    this.insertMessageRow({
      id: args.messageId,
      threadId,
      emailId: args.emailId,
      direction: "inbound",
      rfc822MessageId: args.rfc822MessageId,
      inReplyTo: args.inReplyTo,
      referencesChain: args.referencesChain,
      fromEmail: args.fromEmail,
      toEmail: args.toEmail,
      subject: args.subject,
      snippet: args.snippet,
      hasHtml: args.hasHtml,
      hasText: args.hasText,
      attachmentCount: args.attachments.length,
      rawR2Key: args.rawR2Key,
      createdAt: now,
    });

    for (const att of args.attachments) {
      this.attachments.set(att.id, {
        id: att.id,
        messageId: args.messageId,
        filename: att.filename,
        contentType: att.contentType,
        sizeBytes: att.sizeBytes,
        r2Key: att.r2Key,
        contentId: att.contentId,
      });
    }

    return {
      threadId,
      messageId: args.messageId,
      agentRunId: this.threadAgentRunId(threadId),
    };
  }

  async setThreadAgentRun(
    threadId: string,
    runId: string | null
  ): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return;
    }
    thread.agentRunId = runId;
    thread.updatedAt = Date.now();
  }

  async insertOutbound(
    args: InsertOutboundArgs
  ): Promise<{ messageId: string }> {
    const now = Date.now();
    this.insertMessageRow({
      id: args.messageId,
      threadId: args.threadId,
      emailId: args.emailId,
      direction: "outbound",
      rfc822MessageId: args.rfc822MessageId,
      inReplyTo: args.inReplyTo,
      referencesChain: args.referencesChain,
      fromEmail: args.fromEmail,
      toEmail: args.toEmail,
      subject: args.subject,
      snippet: args.snippet,
      hasHtml: args.hasHtml,
      hasText: args.hasText,
      attachmentCount: 0,
      rawR2Key: args.rawR2Key,
      createdAt: now,
    });
    return { messageId: args.messageId };
  }

  async touchThread(threadId: string): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return;
    }
    const now = Date.now();
    thread.lastMessageAt = now;
    thread.updatedAt = now;
  }

  async deleteMessage(messageId: string): Promise<void> {
    this.messages.delete(messageId);
    for (const [id, att] of this.attachments) {
      if (att.messageId === messageId) {
        this.attachments.delete(id);
      }
    }
  }

  async pruneInactiveThreads(
    cutoffMs: number
  ): Promise<{ r2Prefixes: string[] }> {
    const r2Prefixes: string[] = [];

    for (const thread of this.threads.values()) {
      if (thread.lastMessageAt >= cutoffMs) {
        continue;
      }

      for (const message of this.messages.values()) {
        if (message.threadId !== thread.id) {
          continue;
        }
        r2Prefixes.push(`${message.emailId}/${message.id}`);
        for (const [id, att] of this.attachments) {
          if (att.messageId === message.id) {
            this.attachments.delete(id);
          }
        }
        this.messages.delete(message.id);
      }
      this.threads.delete(thread.id);
    }

    return { r2Prefixes };
  }

  async createOutboundThread(args: {
    emailId: string;
    subject: string;
    fromEmail: string;
  }): Promise<{ threadId: string }> {
    const threadId = this.createThread(
      {
        emailId: args.emailId,
        subject: args.subject,
        fromEmail: args.fromEmail,
      },
      Date.now()
    );
    return { threadId };
  }

  async listThreads(
    emailId: string,
    limit: number,
    offset: number,
    search?: string
  ): Promise<MailboxThreadRow[]> {
    const term = search?.trim().toLowerCase();
    let rows = [...this.threads.values()].filter((t) => t.emailId === emailId);

    if (term) {
      rows = rows.filter(
        (t) =>
          t.subject.toLowerCase().includes(term) ||
          t.fromEmail.toLowerCase().includes(term)
      );
    }

    rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return rows.slice(offset, offset + limit).map((t) => ({
      id: t.id,
      emailId: t.emailId,
      subject: t.subject,
      fromEmail: t.fromEmail,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
    }));
  }

  async listThreadAttachments(
    threadId: string
  ): Promise<MailboxAttachmentRow[]> {
    const messageIds = new Set(
      [...this.messages.values()]
        .filter((m) => m.threadId === threadId)
        .map((m) => m.id)
    );

    return [...this.attachments.values()]
      .filter((a) => messageIds.has(a.messageId))
      .map((a) => ({
        id: a.id,
        messageId: a.messageId,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        r2Key: a.r2Key,
      }));
  }

  async getAttachment(
    attachmentId: string
  ): Promise<MailboxAttachmentRow | undefined> {
    const att = this.attachments.get(attachmentId);
    if (!att) {
      return undefined;
    }
    return {
      id: att.id,
      messageId: att.messageId,
      filename: att.filename,
      contentType: att.contentType,
      sizeBytes: att.sizeBytes,
      r2Key: att.r2Key,
    };
  }

  async getThread(threadId: string): Promise<MailboxThreadRow | undefined> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return undefined;
    }
    return {
      id: thread.id,
      emailId: thread.emailId,
      subject: thread.subject,
      fromEmail: thread.fromEmail,
      lastMessageAt: thread.lastMessageAt,
      createdAt: thread.createdAt,
    };
  }

  async listThreadMessages(threadId: string): Promise<MailboxMessageRow[]> {
    return [...this.messages.values()]
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({
        id: m.id,
        direction: m.direction,
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        subject: m.subject,
        snippet: m.snippet,
        rfc822MessageId: m.rfc822MessageId,
        inReplyTo: m.inReplyTo,
        referencesChain: m.referencesChain,
        hasHtml: m.hasHtml,
        hasText: m.hasText,
        attachmentCount: m.attachmentCount,
        createdAt: m.createdAt,
      }));
  }

  private threadAgentRunId(threadId: string): string | null {
    return this.threads.get(threadId)?.agentRunId ?? null;
  }

  private resolveThread(args: IngestInboundArgs): string | undefined {
    if (args.verifiedThreadId && this.threads.has(args.verifiedThreadId)) {
      return args.verifiedThreadId;
    }

    const candidateRfcIds = [
      ...(args.inReplyTo ? [args.inReplyTo] : []),
      ...args.references,
    ];
    if (candidateRfcIds.length > 0) {
      for (const message of this.messages.values()) {
        if (
          message.emailId === args.emailId &&
          candidateRfcIds.includes(message.rfc822MessageId)
        ) {
          return message.threadId;
        }
      }
    }

    const normalized = normalizeSubject(args.subject);
    if (!normalized) {
      return undefined;
    }

    const since = Date.now() - THIRTY_DAYS_MS;
    const candidates = [...this.threads.values()]
      .filter(
        (t) =>
          t.emailId === args.emailId &&
          t.fromEmail === args.fromEmail &&
          t.lastMessageAt >= since
      )
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .slice(0, 20);

    const match = candidates.find(
      (t) => normalizeSubject(t.subject) === normalized
    );
    return match?.id;
  }

  private createThread(
    args: {
      emailId: string;
      subject: string;
      fromEmail: string;
      fromName?: string | null;
    },
    now: number
  ): string {
    const threadId = uuidv7();
    this.threads.set(threadId, {
      id: threadId,
      emailId: args.emailId,
      subject: args.subject,
      fromEmail: args.fromEmail,
      fromName: args.fromName ?? null,
      archivedAt: null,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      agentRunId: null,
    });
    return threadId;
  }

  private insertMessageRow(row: MessageRecord): void {
    this.messages.set(row.id, row);
  }
}

export type MailboxStoreStub = MailboxStore;

class NodeMailboxHub {
  private readonly stores = new Map<string, MailboxStore>();

  get(name: string): MailboxStore {
    const existing = this.stores.get(name);
    if (existing) {
      return existing;
    }
    const store = new MailboxStore();
    this.stores.set(name, store);
    return store;
  }
}

export const nodeMailboxHub = new NodeMailboxHub();

export function createNodeMailboxNamespace(): DurableObjectNamespace {
  return {
    idFromName: (name: string) =>
      ({ toString: () => name }) as DurableObjectId,
    idFromString: (id: string) => ({ toString: () => id }) as DurableObjectId,
    newUniqueId: () =>
      ({ toString: () => crypto.randomUUID() }) as DurableObjectId,
    get: (id: DurableObjectId) => {
      const name = id.toString();
      const store = nodeMailboxHub.get(name);
      return store as unknown as DurableObjectStub;
    },
  } as DurableObjectNamespace;
}
