import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSeedanceVideoCheckQuery,
  getSeedanceVideoCheckResult,
  SeedanceOfficialResultCallError,
} from "./ark-official-result";

const credentials = {
  accessKeyId: "AKTEST",
  secretAccessKey: "secret",
  region: "cn-beijing",
} as const;

function stubJsonResponse(status: number, body: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

describe("seedance official result volcano calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs the full Create envelope instead of only Result", async () => {
    const envelope = {
      ResponseMetadata: {
        RequestId: "req-create-1",
        Action: "CreateArkOfficialResultQuery",
        Version: "2024-01-01",
        Service: "ark",
        Region: "cn-beijing",
      },
      Result: {
        QueryID: "2026082417262700441",
      },
    };
    stubJsonResponse(200, envelope);

    const created = await createSeedanceVideoCheckQuery({
      credentials,
      videoUrl: "https://example.com/video.mp4",
    });

    expect(created.queryId).toBe("2026082417262700441");
    expect(created.log.httpStatus).toBe(200);
    expect(created.log.response).toEqual(envelope);
    expect(created.log.request).toMatchObject({
      Type: "content_url",
      ContentURL: "https://example.com/video.mp4",
    });
  });

  it("logs the full Get envelope including official result fields", async () => {
    const envelope = {
      ResponseMetadata: {
        RequestId: "req-get-1",
        Action: "GetArkOfficialResult",
        Version: "2024-01-01",
        Service: "ark",
        Region: "cn-beijing",
      },
      Result: {
        IsOfficial: "Null",
        Status: "succeeded",
        ResourceType: "video",
        ModelName: "seedance-1-0",
        Resolution: "1080p",
        Message: "当前可识别信息不足",
      },
    };
    stubJsonResponse(200, envelope);

    const result = await getSeedanceVideoCheckResult({
      credentials,
      queryId: "2026082417262700441",
    });

    expect(result.status).toBe("completed");
    expect(result.isOfficial).toBeNull();
    expect(result.modelVersion).toBe("seedance-1-0");
    expect(result.resolution).toBe("1080p");
    expect(result.message).toBe("当前可识别信息不足");
    expect(result.log.httpStatus).toBe(200);
    expect(result.log.response).toEqual(envelope);
    expect(result.raw).toEqual(envelope);
  });

  it("keeps the full error envelope on the thrown log", async () => {
    const envelope = {
      ResponseMetadata: {
        RequestId: "req-err-1",
        Action: "CreateArkOfficialResultQuery",
        Error: {
          Code: "InvalidParameter.type",
          Message: "The parameter type is invalid.",
        },
      },
    };
    stubJsonResponse(200, envelope);

    await expect(
      createSeedanceVideoCheckQuery({
        credentials,
        videoUrl: "https://example.com/video.mp4",
      })
    ).rejects.toMatchObject({
      name: "SeedanceOfficialResultCallError",
      volcanoCode: "InvalidParameter.type",
      log: {
        action: "CreateArkOfficialResultQuery",
        httpStatus: 200,
        response: envelope,
      },
    } satisfies Partial<SeedanceOfficialResultCallError>);
  });
});
