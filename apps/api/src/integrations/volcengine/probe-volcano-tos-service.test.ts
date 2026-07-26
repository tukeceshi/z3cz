import { describe, expect, it, vi } from "vitest";

import { probeVolcanoTosServiceStatus } from "./probe-volcano-tos-service";
import { TosRequestError } from "./tos-errors";
import { VolcengineTosClient } from "./tos-client";

vi.mock("./tos-client", () => ({
  VolcengineTosClient: {
    forRegion: vi.fn(),
  },
}));

describe("probeVolcanoTosServiceStatus", () => {
  it("returns not_opened for AccountDisable on create probe", async () => {
    vi.mocked(VolcengineTosClient.forRegion).mockReturnValue({
      createBucket: vi.fn().mockRejectedValue(
        new TosRequestError({
          message: "TOS create bucket failed (403): account disabled",
          httpStatus: 403,
          tosCode: "AccountDisable",
        })
      ),
      listBuckets: vi.fn(),
    } as unknown as VolcengineTosClient);

    const result = await probeVolcanoTosServiceStatus({
      accessKeyId: "AKTEST",
      secretAccessKey: "secret",
      region: "cn-guangzhou",
    });

    expect(result.status).toBe("not_opened");
    expect(result.code).toBe("volcano_tos_not_opened");
  });

  it("returns not_opened for AccountDisable on list buckets", async () => {
    vi.mocked(VolcengineTosClient.forRegion).mockReturnValue({
      createBucket: vi.fn().mockResolvedValue(undefined),
      listBuckets: vi.fn().mockRejectedValue(
        new TosRequestError({
          message: "TOS list buckets failed (403): account disabled",
          httpStatus: 403,
          tosCode: "AccountDisable",
        })
      ),
    } as unknown as VolcengineTosClient);

    const result = await probeVolcanoTosServiceStatus({
      accessKeyId: "AKTEST",
      secretAccessKey: "secret",
      region: "cn-guangzhou",
    });

    expect(result.status).toBe("not_opened");
    expect(result.code).toBe("volcano_tos_not_opened");
  });

  it("returns opened when create probe succeeds and buckets list succeeds", async () => {
    vi.mocked(VolcengineTosClient.forRegion).mockReturnValue({
      createBucket: vi.fn().mockResolvedValue(undefined),
      listBuckets: vi.fn().mockResolvedValue(["my-bucket"]),
    } as unknown as VolcengineTosClient);

    const result = await probeVolcanoTosServiceStatus({
      accessKeyId: "AKTEST",
      secretAccessKey: "secret",
      region: "cn-guangzhou",
    });

    expect(result.status).toBe("opened");
    expect(result.buckets).toEqual(["my-bucket"]);
  });

  it("returns opened when probe bucket already exists and list is empty", async () => {
    vi.mocked(VolcengineTosClient.forRegion).mockReturnValue({
      createBucket: vi.fn().mockRejectedValue(
        new TosRequestError({
          message: "TOS create bucket failed (409): already exists",
          httpStatus: 409,
          tosCode: "BucketAlreadyOwnedByYou",
        })
      ),
      listBuckets: vi.fn().mockResolvedValue([]),
    } as unknown as VolcengineTosClient);

    const result = await probeVolcanoTosServiceStatus({
      accessKeyId: "AKTEST",
      secretAccessKey: "secret",
      region: "cn-guangzhou",
    });

    expect(result.status).toBe("opened");
    expect(result.buckets).toEqual([]);
  });
});
