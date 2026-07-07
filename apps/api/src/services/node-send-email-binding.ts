import fs from "node:fs/promises";
import path from "node:path";

import { EmailMessage } from "../shims/cloudflare-email";

interface StructuredEmailPayload {
  readonly from: string;
  readonly to: string | string[];
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly replyTo?: string;
}

function buildSimpleMime(payload: StructuredEmailPayload): string {
  const to = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;
  const lines = [
    `From: ${payload.from}`,
    `To: ${to}`,
    `Subject: ${payload.subject}`,
    "MIME-Version: 1.0",
  ];
  if (payload.replyTo) {
    lines.push(`Reply-To: ${payload.replyTo}`);
  }
  if (payload.html && payload.text) {
    const boundary = `dafthunk-${crypto.randomUUID()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return [
      lines.join("\r\n"),
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      payload.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      payload.html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }
  if (payload.html) {
    lines.push("Content-Type: text/html; charset=utf-8");
    return `${lines.join("\r\n")}\r\n\r\n${payload.html}`;
  }
  lines.push("Content-Type: text/plain; charset=utf-8");
  return `${lines.join("\r\n")}\r\n\r\n${payload.text ?? ""}`;
}

function extractRawMime(message: unknown): string {
  if (message instanceof EmailMessage) {
    return message.raw;
  }
  if (
    message &&
    typeof message === "object" &&
    "raw" in message &&
    typeof (message as { raw: unknown }).raw === "string"
  ) {
    return (message as { raw: string }).raw;
  }
  return buildSimpleMime(message as StructuredEmailPayload);
}

/**
 * Node.js SendEmail binding — writes outbound MIME to the local outbox directory.
 * Enables send-email / mailbox send nodes in Docker without Cloudflare Email Routing.
 */
export function createNodeSendEmailBinding(outboxDir: string): SendEmail {
  return {
    send: async (message: unknown) => {
      const messageId = crypto.randomUUID();
      await fs.mkdir(outboxDir, { recursive: true });
      const rawMime = extractRawMime(message);
      const filePath = path.join(outboxDir, `${messageId}.eml`);
      await fs.writeFile(filePath, rawMime, "utf8");
      console.log(`[node-email] outbound message saved: ${filePath}`);
      return { messageId };
    },
  } as SendEmail;
}

export async function sendRawMimeEmailNode(
  outboxDir: string,
  from: string,
  to: string,
  rawMime: string
): Promise<void> {
  const message = new EmailMessage(from, to, rawMime);
  await createNodeSendEmailBinding(outboxDir).send(message);
}
