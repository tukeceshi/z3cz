import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  attachments,
  createDatabase,
  createThread,
  findUserByEmail,
  getInboxByAlias,
  messages,
  organizations,
  selectLastInboundMessage,
  threadReads,
  threads,
  users,
} from "../../db";
import { sendOutboundSupportMessage } from "../../support-send";
import { SUPPORT_INBOX_ALIAS } from "../../support-storage";

const adminSupportRoutes = new Hono<ApiContext>();

const threadSummaryColumns = {
  id: threads.id,
  subject: threads.subject,
  fromEmail: threads.fromEmail,
  fromName: threads.fromName,
  archivedAt: threads.archivedAt,
  lastMessageAt: threads.lastMessageAt,
  createdAt: threads.createdAt,
  updatedAt: threads.updatedAt,
  userId: threads.userId,
  userName: users.name,
  userAvatarUrl: users.avatarUrl,
  organizationId: threads.organizationId,
  organizationName: organizations.name,
} as const;

/** GET /admin/support/threads 锟?paginated. `unread` projected per row. */
adminSupportRoutes.get(
  "/threads",
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      // "inbox" (default) hides archived; "archived" shows only archived;
      // "all" shows both. Kept as a string union so the URL stays readable.
      view: z.enum(["inbox", "archived", "all"]).default("inbox"),
      search: z.string().optional(),
      userId: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDatabase(c.env);
    const { page, limit, view, search, userId } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [];
    if (view === "inbox") conditions.push(isNull(threads.archivedAt));
    else if (view === "archived")
      conditions.push(isNotNull(threads.archivedAt));
    if (userId) conditions.push(eq(threads.userId, userId));
    if (search) {
      const like_ = `%${search}%`;
      conditions.push(
        sql`(${threads.subject} LIKE ${like_} OR ${threads.fromEmail} LIKE ${like_})`
      );
    }
    const whereClause =
      conditions.length > 0
        ? sql`${sql.join(conditions, sql` AND `)}`
        : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(threads)
      .where(whereClause);

    const adminUserId = c.get("jwtPayload")?.sub;

    const rows = await db
      .select({
        ...threadSummaryColumns,
        lastReadAt: threadReads.lastReadAt,
      })
      .from(threads)
      .leftJoin(users, eq(threads.userId, users.id))
      .leftJoin(organizations, eq(threads.organizationId, organizations.id))
      .leftJoin(
        threadReads,
        and(
          eq(threadReads.threadId, threads.id),
          adminUserId ? eq(threadReads.userId, adminUserId) : sql`1 = 0`
        )
      )
      .where(whereClause)
      .orderBy(desc(threads.lastMessageAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      threads: rows.map(({ lastReadAt, ...rest }) => ({
        ...rest,
        unread: lastReadAt === null || lastReadAt < rest.lastMessageAt,
      })),
      pagination: {
        page,
        limit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / limit),
      },
    });
  }
);

/** GET /admin/support/unread-count 锟?drives the sidebar badge. */
adminSupportRoutes.get("/unread-count", async (c) => {
  const db = createDatabase(c.env);
  const adminUserId = c.get("jwtPayload")?.sub;
  if (!adminUserId) return c.json({ count: 0 });

  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(threads)
    .leftJoin(
      threadReads,
      and(
        eq(threadReads.threadId, threads.id),
        eq(threadReads.userId, adminUserId)
      )
    )
    .where(
      and(
        isNull(threads.archivedAt),
        or(
          isNull(threadReads.lastReadAt),
          lt(threadReads.lastReadAt, threads.lastMessageAt)
        )
      )
    );

  return c.json({ count: row?.count ?? 0 });
});

/** GET /admin/support/threads/:id 锟?thread + messages + attachment metadata. */
adminSupportRoutes.get("/threads/:id", async (c) => {
  const db = createDatabase(c.env);
  const id = c.req.param("id");

  const [thread] = await db
    .select(threadSummaryColumns)
    .from(threads)
    .leftJoin(users, eq(threads.userId, users.id))
    .leftJoin(organizations, eq(threads.organizationId, organizations.id))
    .where(eq(threads.id, id))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, id))
    .orderBy(asc(messages.createdAt));

  const messageIds = messageRows.map((m) => m.id);
  const attachmentRows = messageIds.length
    ? await db
        .select()
        .from(attachments)
        .where(inArray(attachments.messageId, messageIds))
    : [];

  const attachmentsByMessage = new Map<string, typeof attachmentRows>();
  for (const a of attachmentRows) {
    const list = attachmentsByMessage.get(a.messageId) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.messageId, list);
  }

  const adminUserId = c.get("jwtPayload")?.sub;
  if (adminUserId) {
    const now = new Date();
    try {
      await db
        .insert(threadReads)
        .values({ threadId: id, userId: adminUserId, lastReadAt: now })
        .onConflictDoUpdate({
          target: [threadReads.threadId, threadReads.userId],
          set: { lastReadAt: now },
        });
    } catch (error) {
      // Read tracking is best-effort 锟?never fail the request because the
      // badge couldn't update.
      console.error("[support] failed to mark thread as read", error);
    }
  }

  return c.json({
    thread,
    messages: messageRows.map((m) => ({
      ...m,
      attachments: (attachmentsByMessage.get(m.id) ?? []).map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        contentId: a.contentId,
      })),
    })),
  });
});

/**
 * POST /admin/support/threads — admin-initiated outbound thread. Creates a
 * new thread addressed to an arbitrary email and sends the first message
 * via the shared outbound path. Auto-links to a registered user when the
 * recipient's address matches `users.email`.
 */
adminSupportRoutes.post(
  "/threads",
  zValidator(
    "json",
    z
      .object({
        toEmail: z.string().email(),
        subject: z.string().trim().min(1),
        text: z.string().optional(),
        html: z.string().optional(),
      })
      .refine((v) => Boolean(v.text || v.html), {
        message: "Provide at least one of 'text' or 'html'",
      })
  ),
  async (c) => {
    const db = createDatabase(c.env);
    const { toEmail, subject, text, html } = c.req.valid("json");
    const normalizedTo = toEmail.toLowerCase();

    const [inbox, linkedUser] = await Promise.all([
      getInboxByAlias(db, SUPPORT_INBOX_ALIAS),
      findUserByEmail(db, normalizedTo),
    ]);
    if (!inbox) {
      return c.json({ error: "Support inbox not configured" }, 500);
    }
    const now = new Date();
    const thread = await createThread(db, {
      inboxId: inbox.id,
      subject,
      fromEmail: normalizedTo,
      fromName: null,
      userId: linkedUser?.id ?? null,
      organizationId: linkedUser?.organizationId ?? null,
      lastMessageAt: now,
    });

    const result = await sendOutboundSupportMessage(db, c.env, c.executionCtx, {
      threadId: thread.id,
      inboxId: inbox.id,
      toAddress: normalizedTo,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      adminUserId: c.get("jwtPayload")?.sub ?? null,
    });

    if (!result.ok) {
      // Roll back the thread we just created so a failed send doesn't leave
      // an orphaned empty thread in the inbox.
      try {
        await db.delete(threads).where(eq(threads.id, thread.id));
      } catch (cleanupError) {
        console.error("[support create] thread cleanup failed", cleanupError);
      }
      return c.json({ error: result.error }, result.status);
    }

    return c.json({ thread, messageId: result.messageId });
  }
);

/** POST /admin/support/threads/:id/reply 锟?threaded reply via SUPPORT_EMAIL_FROM. */
adminSupportRoutes.post(
  "/threads/:id/reply",
  zValidator(
    "json",
    z
      .object({
        subject: z.string().optional(),
        text: z.string().optional(),
        html: z.string().optional(),
      })
      .refine((v) => Boolean(v.text || v.html), {
        message: "Provide at least one of 'text' or 'html'",
      })
  ),
  async (c) => {
    const db = createDatabase(c.env);
    const threadId = c.req.param("id");
    const body = c.req.valid("json");

    const [threadRows, lastInboundRows] = await Promise.all([
      db
        .select({
          inboxId: threads.inboxId,
          subject: threads.subject,
          fromEmail: threads.fromEmail,
        })
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1),
      selectLastInboundMessage(db, threadId),
    ]);
    const thread = threadRows[0];
    const lastInbound = lastInboundRows[0];
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }
    const subject = (body.subject ?? thread.subject).trim() || thread.subject;
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    const references = lastInbound?.referencesChain
      ? lastInbound.referencesChain.split(/\s+/).filter(Boolean)
      : [];

    const result = await sendOutboundSupportMessage(db, c.env, c.executionCtx, {
      threadId,
      inboxId: thread.inboxId,
      toAddress: thread.fromEmail,
      subject: replySubject,
      ...(body.text ? { text: body.text } : {}),
      ...(body.html ? { html: body.html } : {}),
      inReplyTo: lastInbound?.rfc822MessageId ?? null,
      references,
      adminUserId: c.get("jwtPayload")?.sub ?? null,
    });

    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ messageId: result.messageId });
  }
);

/** PATCH /admin/support/threads/:id 锟?archive / unarchive. */
adminSupportRoutes.patch(
  "/threads/:id",
  zValidator("json", z.object({ archived: z.boolean() })),
  async (c) => {
    const db = createDatabase(c.env);
    const id = c.req.param("id");
    const { archived } = c.req.valid("json");

    const result = await db
      .update(threads)
      .set({
        archivedAt: archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, id))
      .returning();

    if (result.length === 0) {
      return c.json({ error: "Thread not found" }, 404);
    }
    return c.json({ thread: result[0] });
  }
);

export default adminSupportRoutes;
