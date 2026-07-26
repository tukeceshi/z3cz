import { describe, expect, it, vi, afterEach } from "vitest";

import { VolcengineTosClient } from "./tos-client";
import { TosRequestError } from "./tos-errors";

describe("VolcengineTosClient listBuckets errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws TosRequestError with AccountDisable code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            Code: "AccountDisable",
            Message: "The account does not open tos service.",
          }),
          { status: 403 }
        )
      )
    );

    const client = VolcengineTosClient.forRegion({
      accessKeyId: "AKTEST",
      secretAccessKey: "secret",
      region: "cn-guangzhou",
    });

    await expect(client.listBuckets()).rejects.toMatchObject({
      name: "TosRequestError",
      httpStatus: 403,
      tosCode: "AccountDisable",
    } satisfies Partial<TosRequestError>);
  });
});
