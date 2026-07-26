export type VolcanoTosServiceStatus =
  | "opened"
  | "not_opened"
  | "auth_error"
  | "transient_error";

export interface VolcanoProbeTosBucketsResponse {
  readonly status: VolcanoTosServiceStatus;
  readonly buckets: readonly string[];
  readonly code?: string;
  readonly message?: string;
}

export interface VolcanoProbeTosBucketsRequest {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
}
