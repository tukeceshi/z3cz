import { afterEach, describe, expect, it, vi } from "vitest";

import {
  probeSiteUrl,
  siteDomainJumpUrl,
  siteDomainNeedsJump,
  siteDomainPublicUrl,
} from "./site-domain-next-url";

const ipTab = {
  protocol: "http:",
  hostname: "203.0.113.10",
  pathname: "/admin/site-domain",
  search: "?from=bind",
  hash: "#status",
} as const;

const httpsTab = {
  protocol: "https:",
  hostname: "old.example.com",
  pathname: "/admin/site-domain",
  search: "",
  hash: "",
} as const;

describe("siteDomainPublicUrl", () => {
  it("keeps the current admin path on the new https origin", () => {
    expect(siteDomainPublicUrl("app.example.com", ipTab)).toBe(
      "https://app.example.com/admin/site-domain?from=bind#status"
    );
  });
});

describe("siteDomainNeedsJump", () => {
  it("jumps from an IP or other host, but not from the bound hostname", () => {
    expect(siteDomainNeedsJump("app.example.com", "203.0.113.10")).toBe(true);
    expect(siteDomainNeedsJump("app.example.com", "APP.example.com")).toBe(
      false
    );
  });
});

describe("siteDomainJumpUrl", () => {
  it("offers the new https page as soon as a bind is accepted", () => {
    expect(
      siteDomainJumpUrl("app.example.com", ipTab, {
        switching: true,
        applyError: null,
      })
    ).toBe("https://app.example.com/admin/site-domain?from=bind#status");
  });

  it("keeps the jump after the switch finishes while the old tab is still open", () => {
    expect(
      siteDomainJumpUrl("app.example.com", ipTab, {
        switching: false,
        applyError: null,
      })
    ).toBe("https://app.example.com/admin/site-domain?from=bind#status");
  });

  it("does not jump when the current tab is already on the bound host", () => {
    expect(
      siteDomainJumpUrl("old.example.com", httpsTab, {
        switching: false,
        applyError: null,
      })
    ).toBeNull();
  });

  it("does not jump after a failed apply that left the previous address live", () => {
    expect(
      siteDomainJumpUrl("app.example.com", ipTab, {
        switching: false,
        applyError: "compose failed",
      })
    ).toBeNull();
  });

  it("offers http on the same host when a https tab unbinds the domain", () => {
    expect(
      siteDomainJumpUrl(null, httpsTab, {
        switching: true,
        applyError: null,
      })
    ).toBe("http://old.example.com/admin/site-domain");
  });

  it("does not invent a jump when an http tab unbinds the domain", () => {
    expect(
      siteDomainJumpUrl(null, ipTab, {
        switching: true,
        applyError: null,
      })
    ).toBeNull();
  });
});

describe("probeSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a completed no-cors fetch as reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({}));
    await expect(probeSiteUrl("https://app.example.com/")).resolves.toBe(true);
  });

  it("treats a network failure as not reachable yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(probeSiteUrl("https://app.example.com/")).resolves.toBe(false);
  });
});
