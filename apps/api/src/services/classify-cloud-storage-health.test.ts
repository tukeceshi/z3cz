import { describe, expect, it } from "vitest";

import {
  applyCloudStorageFailureEscalation,
  classifyCloudStorageHealthFromTos,
  tosErrorForTest,
} from "./classify-cloud-storage-health";
import { TOS_ACCOUNT_DISABLE_CODE } from "../integrations/volcengine/tos-errors";

describe("classifyCloudStorageHealthFromTos", () => {
  it("maps AccountDisable to blocked service_not_opened", () => {
    expect(
      classifyCloudStorageHealthFromTos({
        httpStatus: 403,
        tosCode: TOS_ACCOUNT_DISABLE_CODE,
        message: "Account disabled",
      })
    ).toEqual({
      status: "blocked",
      reason: "service_not_opened",
      message: "Account disabled",
    });
  });

  it("maps quota errors to blocked quota_exceeded", () => {
    expect(
      classifyCloudStorageHealthFromTos({
        httpStatus: 403,
        tosCode: "QuotaExceeded",
        message: "Quota exceeded",
      })
    ).toMatchObject({
      status: "blocked",
      reason: "quota_exceeded",
    });
  });

  it("maps auth failures to blocked auth_invalid", () => {
    expect(
      classifyCloudStorageHealthFromTos({
        httpStatus: 401,
        tosCode: "InvalidAccessKeyId",
        message: "Invalid key",
      })
    ).toMatchObject({
      status: "blocked",
      reason: "auth_invalid",
    });
  });

  it("maps transient server errors to degraded", () => {
    expect(
      classifyCloudStorageHealthFromTos({
        httpStatus: 503,
        tosCode: null,
        message: "Service unavailable",
      })
    ).toEqual({
      status: "degraded",
      reason: null,
      message: "Service unavailable",
    });
  });

  it("classifies TosRequestError via helper", () => {
    const error = tosErrorForTest({
      httpStatus: 404,
      tosCode: "NoSuchBucket",
      message: "missing bucket",
    });
    expect(error.tosCode).toBe("NoSuchBucket");
  });
});

describe("applyCloudStorageFailureEscalation", () => {
  it("increments degraded failures and escalates at threshold", () => {
    const first = applyCloudStorageFailureEscalation({
      classified: {
        status: "degraded",
        reason: null,
        message: "503",
      },
      previousFailureCount: 0,
    });
    expect(first.status).toBe("degraded");
    expect(first.consecutiveFailureCount).toBe(1);

    const escalated = applyCloudStorageFailureEscalation({
      classified: {
        status: "degraded",
        reason: null,
        message: "503",
      },
      previousFailureCount: 2,
    });
    expect(escalated.status).toBe("blocked");
    expect(escalated.consecutiveFailureCount).toBe(3);
  });
});
