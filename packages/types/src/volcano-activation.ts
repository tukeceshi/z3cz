export type ModelActivationStatus =
  | "open"
  | "not_open"
  | "service_not_open"
  | "invalid_model_id"
  | "auth_error"
  | "transient_error"
  | "unknown";

export interface VolcanoModelActivationCacheEntry {
  readonly status: ModelActivationStatus;
  readonly probedAt: string;
  readonly errorCode: string | null;
  readonly message: string | null;
}

export interface VolcanoActivationProbeResult {
  readonly canonicalId: string;
  readonly providerModelId: string;
  readonly status: ModelActivationStatus;
  readonly errorCode: string | null;
  readonly message: string | null;
  readonly probedAt: string;
}

export interface VolcanoProbeActivationResponse {
  readonly results: readonly VolcanoActivationProbeResult[];
}

export interface VolcanoProbeCredentialsRequest {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly canonicalIds?: readonly string[];
}
