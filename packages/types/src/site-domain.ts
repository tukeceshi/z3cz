export type SiteDomainUnavailableReason = "unsupported" | "unreachable";

export type SiteDomainErrorCode =
  | "invalid_chars"
  | "local_name"
  | "invalid_domain"
  | "applying"
  | "unavailable";

export interface SiteDomainStatus {
  readonly available: boolean;
  readonly siteAddress: string | null;
  readonly httpOnly: boolean;
  readonly applyError: string | null;
  readonly unavailableReason: SiteDomainUnavailableReason | null;
}

export interface UpdateSiteDomainRequest {
  readonly siteAddress: string;
}

export interface UpdateSiteDomainResult {
  readonly accepted: boolean;
  readonly siteAddress: string | null;
  readonly restarting: boolean;
}
