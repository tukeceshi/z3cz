import { describe, expect, it } from "vitest";

import { signTosRequest } from "./tos-sign";

describe("signTosRequest", () => {
  it("produces TOS4 authorization headers for list buckets", async () => {
    const signed = await signTosRequest({
      method: "GET",
      endpoint: "https://tos-cn-beijing.volces.com",
      path: "/",
      accessKeyId: "AKTESTKEY",
      secretAccessKey: "SKTESTSECRET",
      region: "cn-beijing",
    });

    expect(signed.url).toBe("https://tos-cn-beijing.volces.com/");
    expect(signed.headers.Authorization).toMatch(/^TOS4-HMAC-SHA256 Credential=/);
    expect(signed.headers.Authorization).toContain("/cn-beijing/tos/request");
    expect(signed.headers["x-tos-date"]).toMatch(/^\d{8}T\d{6}Z$/);
    expect(signed.headers["x-tos-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
  });
});
