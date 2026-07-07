#!/usr/bin/env node
/**
 * POST a synthetic inbound message to the Node API webhook.
 *
 * Usage:
 *   node apps/api/scripts/simulate-inbound-email.mjs --to handle@mail.dafthunk.com --from alice@example.com --subject "Hi" --body "Hello"
 *
 * Optional:
 *   --api http://localhost:3102
 *   --secret your-inbound-secret
 */

const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
}

const apiBase = readFlag("--api", "http://localhost:3102");
const to = readFlag("--to", "");
const from = readFlag("--from", "alice@example.com");
const subject = readFlag("--subject", "Test inbound");
const body = readFlag("--body", "Hello from simulate-inbound-email.mjs");
const secret = readFlag("--secret", process.env.INBOUND_EMAIL_SECRET ?? "");

if (!to) {
  console.error("Missing --to (recipient address, e.g. your-handle@mail.dafthunk.com)");
  process.exit(1);
}

const raw = [
  `From: ${from}`,
  `To: ${to}`,
  `Subject: ${subject}`,
  "Content-Type: text/plain; charset=utf-8",
  "MIME-Version: 1.0",
  "",
  body,
].join("\r\n");

const headers = { "Content-Type": "application/json" };
if (secret) {
  headers.Authorization = `Bearer ${secret}`;
}

const response = await fetch(`${apiBase}/inbound-email`, {
  method: "POST",
  headers,
  body: JSON.stringify({ from, to, raw }),
});

const text = await response.text();
console.log(`${response.status} ${text}`);

if (!response.ok) {
  process.exit(1);
}
