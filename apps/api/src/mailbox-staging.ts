/**
 * Parse a raw MIME message and return structured metadata for indexing
 * (support inbox D1 or per-org Mailbox DO). Blob storage for bodies and
 * attachments has been removed; only snippet and flags are persisted.
 */

import PostalMime from "postal-mime";
import { v7 as uuidv7 } from "uuid";

import type { MailboxAttachmentInput } from "./durable-objects/mailbox-do";
import { buildSnippet, stripHtml } from "./support-utils";

/** Placeholder for legacy raw_r2_key / r2_key columns (blob storage removed). */
const DEPRECATED_BLOB_KEY = "deprecated";

export interface StagedEmail {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  rfc822MessageId: string;
  inReplyTo: string | null;
  references: string[];
  referencesChain: string | null;
  snippet: string;
  /** Full parsed plain-text body (falls back to stripped HTML), if any. */
  text?: string;
  hasHtml: boolean;
  hasText: boolean;
  rawR2Key: string;
  attachments: MailboxAttachmentInput[];
}

function parseReferences(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toUint8Array(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(content);
}

/**
 * Parse `rawBytes` and return metadata for indexing. Falls back to envelope
 * `from`/`to` when parsed headers are missing.
 */
export async function parseAndStageEmail(
  _env: unknown,
  rawBytes: Uint8Array,
  _keyPrefix: string,
  messageId: string,
  envelope: { from: string; to: string }
): Promise<StagedEmail> {
  const parsed = await new PostalMime().parse(rawBytes);

  const fromEmail = parsed.from?.address ?? envelope.from;
  const fromName = parsed.from?.name || null;
  const toEmail = parsed.to?.[0]?.address ?? envelope.to;
  const subject = parsed.subject?.trim() || "(no subject)";
  const rfc822MessageId =
    parsed.messageId?.trim() || `<${messageId}@inbox.local>`;
  const inReplyTo = parsed.inReplyTo?.trim() || null;
  const references = parseReferences(parsed.references);
  const referencesChain = references.length > 0 ? references.join(" ") : null;
  const textBody = parsed.text ?? undefined;
  const htmlBody = parsed.html ?? undefined;
  const snippet = buildSnippet(textBody ?? stripHtml(htmlBody));

  const parsedAttachments = parsed.attachments ?? [];
  const attachments: MailboxAttachmentInput[] = parsedAttachments.map(
    (att, i) => {
      const filename = att.filename || `attachment-${i + 1}`;
      return {
        id: uuidv7(),
        filename,
        contentType: att.mimeType || "application/octet-stream",
        sizeBytes: toUint8Array(att.content).byteLength,
        r2Key: DEPRECATED_BLOB_KEY,
        contentId: att.contentId ?? null,
      };
    }
  );

  return {
    fromEmail,
    fromName,
    toEmail,
    subject,
    rfc822MessageId,
    inReplyTo,
    references,
    referencesChain,
    snippet,
    text: textBody ?? (htmlBody ? stripHtml(htmlBody) : undefined),
    hasHtml: Boolean(htmlBody),
    hasText: Boolean(textBody),
    rawR2Key: DEPRECATED_BLOB_KEY,
    attachments,
  };
}
