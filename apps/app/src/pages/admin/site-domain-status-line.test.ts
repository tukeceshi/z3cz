import { describe, expect, it } from "vitest";

import { siteDomainStatusLine } from "./site-domain-status-line";

const ready = {
  available: true,
  siteAddress: "example.com",
  applyError: null,
  unavailableReason: null,
} as const;

describe("siteDomainStatusLine", () => {
  it("shows the live domain only after a switch with no error", () => {
    expect(siteDomainStatusLine(ready, false)).toBe("currentDomain");
    expect(siteDomainStatusLine({ ...ready, siteAddress: null }, false)).toBe(
      "currentHttp"
    );
  });

  it("does not describe a failed save as the current domain", () => {
    expect(
      siteDomainStatusLine(
        { ...ready, applyError: "unknown flag: --env-file" },
        false
      )
    ).toBe("savedNotApplied");
    expect(
      siteDomainStatusLine(
        { ...ready, siteAddress: null, applyError: "unknown flag: --env-file" },
        false
      )
    ).toBe("savedHttpNotApplied");
  });

  it("keeps the in-progress line while a switch is still running", () => {
    expect(
      siteDomainStatusLine(
        { ...ready, applyError: "unknown flag: --env-file" },
        true
      )
    ).toBe("currentDomain");
  });

  it("distinguishes an unreachable domain service from an unsupported deploy", () => {
    expect(
      siteDomainStatusLine(
        {
          available: false,
          siteAddress: null,
          applyError: null,
          unavailableReason: "unreachable",
        },
        false
      )
    ).toBe("unreachable");
    expect(
      siteDomainStatusLine(
        {
          available: false,
          siteAddress: null,
          applyError: null,
          unavailableReason: "unsupported",
        },
        false
      )
    ).toBe("unavailable");
  });
});
