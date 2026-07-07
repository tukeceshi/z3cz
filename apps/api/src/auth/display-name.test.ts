import { describe, expect, it } from "vitest";

import { deriveDisplayNameFromEmail } from "./display-name";

describe("deriveDisplayNameFromEmail", () => {
  it("uses the local part before @ as the display name", () => {
    expect(deriveDisplayNameFromEmail("admin@example.com")).toBe("admin");
  });

  it("normalizes email casing before deriving the name", () => {
    expect(deriveDisplayNameFromEmail("  Admin@Example.COM  ")).toBe("admin");
  });

  it("falls back to the full email when no local part exists", () => {
    expect(deriveDisplayNameFromEmail("@example.com")).toBe("@example.com");
  });
});
