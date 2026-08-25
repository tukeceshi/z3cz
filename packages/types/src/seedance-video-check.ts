import type { ObjectReference } from "./workflow";

export const SEEDANCE_VIDEO_CHECK_VOLCANO_REQUIRED_CODE =
  "seedance_video_check_volcano_required" as const;

export const SEEDANCE_VIDEO_CHECK_ENTERPRISE_REQUIRED_CODE =
  "seedance_video_check_enterprise_required" as const;

export type SeedanceVideoCheckSourceType = "url" | "resource" | "object";

export interface SubmitSeedanceVideoCheckRequest {
  readonly source: SeedanceVideoCheckSourceType;
  readonly url?: string;
  readonly resourceId?: string;
  readonly object?: ObjectReference;
}

export interface SubmitSeedanceVideoCheckResponse {
  readonly queryId: string;
  readonly log: SeedanceVideoCheckApiLog;
}

export interface SeedanceVideoCheckApiLog {
  readonly action: string;
  readonly httpStatus: number;
  readonly request: Record<string, unknown>;
  readonly response: Record<string, unknown>;
}

export type SeedanceVideoCheckResultStatus =
  | "pending"
  | "completed"
  | "failed";

export interface SeedanceVideoCheckResult {
  readonly status: SeedanceVideoCheckResultStatus;
  readonly isOfficial: boolean | null;
  readonly modelVersion: string | null;
  readonly resolution: string | null;
  readonly message: string | null;
}

export interface GetSeedanceVideoCheckResultResponse
  extends SeedanceVideoCheckResult {
  /** Temporary debug payload from upstream. */
  readonly raw?: Record<string, unknown>;
  readonly log: SeedanceVideoCheckApiLog;
}

export interface SeedanceVideoCheckErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly name?: string;
  readonly stack?: string;
  readonly volcanoCode?: string;
  readonly details?: unknown;
  readonly log?: SeedanceVideoCheckApiLog;
}
