import { describe, expect, it } from "vitest";

import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "./password";

describe("password auth", () => {
  it("hashes and verifies passwords", async () => {
    const password = "secure-password-123";
    const stored = await hashPassword(password);

    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(validatePasswordStrength("short")).toMatch(/at least/i);
    expect(validatePasswordStrength("valid-password")).toBeNull();
  });
});
