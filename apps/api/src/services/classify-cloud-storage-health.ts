import type {
  CloudStorageBlockReason,
  CloudStorageHealthSnapshot,
  CloudStorageHealthStatus,
} from "@dafthunk/types";
import { CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD } from "@dafthunk/types";

import {
  TOS_ACCOUNT_DISABLE_CODE,
  TosRequestError,
  isTosRequestError,
} from "../integrations/volcengine/tos-errors";

const QUOTA_EXCEEDED_CODES = new Set([
  "QuotaExceeded",
  "EntityTooLarge",
  "InsufficientStorage",
]);

const AUTH_INVALID_CODES = new Set([
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
  "AccessDenied",
]);

const PERMISSION_DENIED_CODES = new Set([
  "AccessDenied",
  "Forbidden",
]);

const BUCKET_MISSING_CODES = new Set(["NoSuchBucket", "NoSuchKey"]);

const ACCOUNT_SUSPENDED_KEYWORDS = [
  "arrear",
  "arrears",
  "欠费",
  "suspend",
  "suspended",
  "disabled",
  "停用",
  "冻结",
] as const;

function messageMatchesAccountSuspended(message: string): boolean {
  const lower = message.toLowerCase();
  return ACCOUNT_SUSPENDED_KEYWORDS.some((keyword) =>
    lower.includes(keyword.toLowerCase())
  );
}

export function classifyCloudStorageHealthFromTos(params: {
  readonly httpStatus: number;
  readonly tosCode: string | null;
  readonly message: string;
}): Pick<CloudStorageHealthSnapshot, "status" | "reason" | "message"> {
  const { httpStatus, tosCode, message } = params;

  if (tosCode === TOS_ACCOUNT_DISABLE_CODE) {
    return {
      status: "blocked",
      reason: "service_not_opened",
      message,
    };
  }

  if (tosCode && QUOTA_EXCEEDED_CODES.has(tosCode)) {
    return {
      status: "blocked",
      reason: "quota_exceeded",
      message,
    };
  }

  if (tosCode && BUCKET_MISSING_CODES.has(tosCode)) {
    return {
      status: "blocked",
      reason: "bucket_missing",
      message,
    };
  }

  if (httpStatus === 401 || (tosCode && AUTH_INVALID_CODES.has(tosCode))) {
    return {
      status: "blocked",
      reason: "auth_invalid",
      message,
    };
  }

  if (
    httpStatus === 403 ||
    (tosCode && PERMISSION_DENIED_CODES.has(tosCode))
  ) {
    if (messageMatchesAccountSuspended(message)) {
      return {
        status: "blocked",
        reason: "account_suspended",
        message,
      };
    }
    return {
      status: "blocked",
      reason: "permission_denied",
      message,
    };
  }

  if (httpStatus === 507 || messageMatchesAccountSuspended(message)) {
    return {
      status: "blocked",
      reason: "account_suspended",
      message,
    };
  }

  if (httpStatus >= 500 || httpStatus === 408 || httpStatus === 429) {
    return {
      status: "degraded",
      reason: null,
      message,
    };
  }

  return {
    status: "degraded",
    reason: null,
    message,
  };
}

export function classifyCloudStorageHealthFromError(
  error: unknown
): Pick<CloudStorageHealthSnapshot, "status" | "reason" | "message"> {
  if (isTosRequestError(error)) {
    return classifyCloudStorageHealthFromTos({
      httpStatus: error.httpStatus,
      tosCode: error.tosCode,
      message: error.message,
    });
  }

  const message =
    error instanceof Error ? error.message : "Cloud storage health check failed";
  return {
    status: "degraded",
    reason: null,
    message,
  };
}

export function mapProbeStatusToHealth(params: {
  readonly probeStatus:
    | "opened"
    | "not_opened"
    | "auth_error"
    | "transient_error";
  readonly message?: string;
}): CloudStorageHealthStatus {
  switch (params.probeStatus) {
    case "opened":
      return "healthy";
    case "not_opened":
    case "auth_error":
      return "blocked";
    case "transient_error":
      return "degraded";
  }
}

export function mapProbeStatusToBlockReason(
  probeStatus: "not_opened" | "auth_error"
): CloudStorageBlockReason {
  return probeStatus === "not_opened" ? "service_not_opened" : "auth_invalid";
}

export function isCloudStorageHealthBlocked(
  status: CloudStorageHealthStatus
): boolean {
  return status === "blocked";
}

export function shouldBlockGenerativeMedia(
  status: CloudStorageHealthStatus,
  consecutiveFailureCount = 0
): boolean {
  if (status === "blocked") return true;
  if (status === "degraded") {
    return consecutiveFailureCount >= CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD;
  }
  return false;
}

export function applyCloudStorageFailureEscalation(params: {
  readonly classified: Pick<
    CloudStorageHealthSnapshot,
    "status" | "reason" | "message"
  >;
  readonly previousFailureCount?: number;
}): Pick<
  CloudStorageHealthSnapshot,
  "status" | "reason" | "message" | "consecutiveFailureCount"
> {
  const previousFailureCount = params.previousFailureCount ?? 0;

  if (params.classified.status === "blocked") {
    return {
      ...params.classified,
      consecutiveFailureCount: CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD,
    };
  }

  if (params.classified.status === "healthy") {
    return {
      ...params.classified,
      consecutiveFailureCount: 0,
    };
  }

  const consecutiveFailureCount = previousFailureCount + 1;
  if (consecutiveFailureCount >= CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD) {
    return {
      status: "blocked",
      reason: params.classified.reason,
      message: params.classified.message,
      consecutiveFailureCount,
    };
  }

  return {
    ...params.classified,
    consecutiveFailureCount,
  };
}

export class CloudStorageUnhealthyError extends Error {
  readonly code = "cloud_storage_unhealthy" as const;
  readonly snapshot: CloudStorageHealthSnapshot;

  constructor(snapshot: CloudStorageHealthSnapshot) {
    super(snapshot.message ?? "Cloud storage is unavailable");
    this.name = "CloudStorageUnhealthyError";
    this.snapshot = snapshot;
  }
}

export function isCloudStorageUnhealthyError(
  error: unknown
): error is CloudStorageUnhealthyError {
  return error instanceof CloudStorageUnhealthyError;
}

export function tosErrorForTest(params: {
  readonly httpStatus: number;
  readonly tosCode: string | null;
  readonly message: string;
}): TosRequestError {
  return new TosRequestError(params);
}
