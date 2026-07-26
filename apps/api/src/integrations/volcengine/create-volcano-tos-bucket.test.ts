import { describe, expect, it, vi } from "vitest";

import { ensureVolcanoTosBucketCreated } from "./create-volcano-tos-bucket";
import { TosRequestError } from "./tos-errors";
import type { VolcengineTosClient } from "./tos-client";

describe("ensureVolcanoTosBucketCreated", () => {
  const organizationId = "019f8866-5300-77c4-9ce2-abc1061ef26a";

  it("returns the bucket name on first successful create", async () => {
    const createBucket = vi.fn().mockResolvedValue(undefined);
    const client = { createBucket, listBuckets: vi.fn() } as unknown as VolcengineTosClient;

    const bucket = await ensureVolcanoTosBucketCreated({
      client,
      bucket: "z3cz-com-019f88665300-test0001",
      organizationId,
    });

    expect(bucket).toBe("z3cz-com-019f88665300-test0001");
    expect(createBucket).toHaveBeenCalledTimes(1);
  });

  it("retries with a new name when the bucket name is globally unavailable", async () => {
    const createBucket = vi
      .fn()
      .mockRejectedValueOnce(
        new TosRequestError({
          message:
            "TOS create bucket failed (409): The requested bucket name is not available.",
          httpStatus: 409,
          tosCode: null,
        })
      )
      .mockResolvedValueOnce(undefined);
    const listBuckets = vi.fn().mockResolvedValue(["other-bucket"]);
    const client = { createBucket, listBuckets } as unknown as VolcengineTosClient;

    const bucket = await ensureVolcanoTosBucketCreated({
      client,
      bucket: "z3cz-com",
      organizationId,
    });

    expect(createBucket).toHaveBeenCalledTimes(2);
    expect(bucket).not.toBe("z3cz-com");
    expect(bucket.startsWith("z3cz-com-")).toBe(true);
    expect(listBuckets).toHaveBeenCalledTimes(1);
  });

  it("treats BucketAlreadyOwnedByYou as success", async () => {
    const createBucket = vi.fn().mockRejectedValue(
      new TosRequestError({
        message: "TOS create bucket failed (409): BucketAlreadyOwnedByYou",
        httpStatus: 409,
        tosCode: "BucketAlreadyOwnedByYou",
      })
    );
    const client = { createBucket, listBuckets: vi.fn() } as unknown as VolcengineTosClient;

    const bucket = await ensureVolcanoTosBucketCreated({
      client,
      bucket: "z3cz-com-019f88665300-owned01",
      organizationId,
    });

    expect(bucket).toBe("z3cz-com-019f88665300-owned01");
  });
});
