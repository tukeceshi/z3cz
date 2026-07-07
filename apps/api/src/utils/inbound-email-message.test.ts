import { describe, expect, it } from "vitest";

import { createForwardableEmailMessage } from "./inbound-email-message";

describe("createForwardableEmailMessage", () => {
  it("builds a readable raw stream and headers", async () => {
    const raw = new TextEncoder().encode(
      "Subject: Hello\r\n\r\nBody text"
    );
    const message = createForwardableEmailMessage({
      from: "alice@example.com",
      to: "bot@mail.dafthunk.com",
      rawBytes: raw,
      authenticationResults: "spf=pass",
    });

    expect(message.from).toBe("alice@example.com");
    expect(message.to).toBe("bot@mail.dafthunk.com");
    expect(message.headers.get("Authentication-Results")).toBe("spf=pass");

    const reader = message.raw.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const combined = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    expect(new TextDecoder().decode(combined)).toContain("Body text");
  });
});
