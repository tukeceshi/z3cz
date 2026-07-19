import { describe, expect, it } from "vitest";

import { buildBucketObjectRequestPath } from "./tos-client";
import { signTosRequest } from "./tos-sign";

describe("buildBucketObjectRequestPath", () => {
  it("uses virtual-hosted style instead of path-style bucket prefix", () => {
    const request = buildBucketObjectRequestPath(
      "cn-guangzhou",
      "z3cz-com-abc",
      "z3cz/workflows/wf_test/ai-image/obj-1.png"
    );

    expect(request.endpoint).toBe(
      "https://z3cz-com-abc.tos-cn-guangzhou.volces.com"
    );
    expect(request.path).toBe(
      "/z3cz/workflows/wf_test/ai-image/obj-1.png"
    );
  });
});

describe("signTosRequest virtual host object upload", () => {
  it("signs against bucket host without bucket in canonical path", async () => {
    const signed = await signTosRequest({
      method: "PUT",
      endpoint: "https://my-bucket.tos-cn-beijing.volces.com",
      path: "/z3cz/workflows/wf_1/ai-image/object.png",
      accessKeyId: "AKTESTKEY",
      secretAccessKey: "SKTESTSECRET",
      region: "cn-beijing",
      contentType: "image/png",
    });

    expect(signed.url).toBe(
      "https://my-bucket.tos-cn-beijing.volces.com/z3cz/workflows/wf_1/ai-image/object.png"
    );
    expect(signed.headers.Host).toBe("my-bucket.tos-cn-beijing.volces.com");
    expect(signed.headers.Authorization).toMatch(/^TOS4-HMAC-SHA256 Credential=/);
  });
});
