import { describe, expect, it } from "vitest";

import { parseTosErrorResponse } from "./parse-tos-error";

describe("parseTosErrorResponse", () => {
  it("parses JSON AccountDisable errors", () => {
    const parsed = parseTosErrorResponse(
      403,
      JSON.stringify({
        Code: "AccountDisable",
        Message: "The account does not open tos service.",
      })
    );

    expect(parsed.code).toBe("AccountDisable");
    expect(parsed.message).toBe("The account does not open tos service.");
  });

  it("parses XML error bodies", () => {
    const parsed = parseTosErrorResponse(
      403,
      "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    );

    expect(parsed.code).toBe("AccessDenied");
    expect(parsed.message).toBe("Access Denied");
  });
});
