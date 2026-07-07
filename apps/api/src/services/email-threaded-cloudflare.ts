/**
 * Cloudflare Email binding helpers — loaded only on Workers when sendThreaded runs.
 * Kept in a separate module so the Node runtime never resolves `cloudflare:email`.
 */
export async function sendRawMimeEmail(
  binding: SendEmail,
  from: string,
  to: string,
  rawMime: string
): Promise<void> {
  const { EmailMessage } = await import("cloudflare:email");
  const message = new EmailMessage(from, to, rawMime);
  await binding.send(message);
}
