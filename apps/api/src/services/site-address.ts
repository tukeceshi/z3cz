const SITE_ADDRESS_ERROR = {
  invalidChars: "invalid_chars",
  localName: "local_name",
  invalidDomain: "invalid_domain",
} as const;

export type SiteAddressErrorCode =
  (typeof SITE_ADDRESS_ERROR)[keyof typeof SITE_ADDRESS_ERROR];

export class SiteAddressValidationError extends Error {
  readonly code: SiteAddressErrorCode;

  constructor(code: SiteAddressErrorCode) {
    super(code);
    this.name = "SiteAddressValidationError";
    this.code = code;
  }
}

export class SiteAddressClientError extends Error {
  readonly code: string | undefined;
  readonly statusCode: number;

  constructor(message: string, statusCode: number, code: string | undefined) {
    super(message);
    this.name = "SiteAddressClientError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Same rules as normalize_site_address in scripts/host/common.sh.
 * Returns `:80` when the field is left empty.
 */
export function normalizeSiteAddress(raw: string): string {
  let value = raw.trim().toLowerCase().replace(/\/+$/, "");
  if (value === "" || value === ":80") {
    return ":80";
  }
  value = value.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\.$/, "");
  if (/[:/?#@\s]/.test(value)) {
    throw new SiteAddressValidationError(SITE_ADDRESS_ERROR.invalidChars);
  }
  if (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)
  ) {
    throw new SiteAddressValidationError(SITE_ADDRESS_ERROR.localName);
  }
  if (
    value.length > 253 ||
    !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/.test(
      value
    )
  ) {
    throw new SiteAddressValidationError(SITE_ADDRESS_ERROR.invalidDomain);
  }
  return value;
}
