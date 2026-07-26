export const VOLCANO_TOS_NOT_OPENED_CODE = "volcano_tos_not_opened" as const;
export const TOS_ACCOUNT_DISABLE_CODE = "AccountDisable" as const;

/** TOS returns these when the service is opened but the probe bucket already exists. */
export const TOS_BUCKET_ALREADY_EXISTS_CODES = [
  "BucketAlreadyExists",
  "BucketAlreadyOwnedByYou",
] as const;

export function isTosBucketAlreadyExistsCode(
  code: string | null
): code is (typeof TOS_BUCKET_ALREADY_EXISTS_CODES)[number] {
  return (
    code !== null &&
    (TOS_BUCKET_ALREADY_EXISTS_CODES as readonly string[]).includes(code)
  );
}

export class TosRequestError extends Error {
  readonly tosCode: string | null;
  readonly httpStatus: number;

  constructor(params: {
    readonly message: string;
    readonly httpStatus: number;
    readonly tosCode: string | null;
  }) {
    super(params.message);
    this.name = "TosRequestError";
    this.httpStatus = params.httpStatus;
    this.tosCode = params.tosCode;
  }
}

export function isTosRequestError(error: unknown): error is TosRequestError {
  return error instanceof TosRequestError;
}

export function isVolcanoTosNotOpenedError(error: unknown): boolean {
  return (
    isTosRequestError(error) &&
    error.tosCode === TOS_ACCOUNT_DISABLE_CODE
  );
}

export function isTosBucketAlreadyOwnedError(error: unknown): boolean {
  return (
    isTosRequestError(error) &&
    error.tosCode === "BucketAlreadyOwnedByYou"
  );
}

/** Bucket name is taken globally or otherwise unavailable for creation. */
export function isTosBucketNameUnavailableError(error: unknown): boolean {
  if (!isTosRequestError(error)) {
    return false;
  }
  if (isTosBucketAlreadyOwnedError(error)) {
    return false;
  }
  if (error.httpStatus !== 409) {
    return false;
  }
  if (error.tosCode === "BucketAlreadyExists") {
    return true;
  }
  return error.message.toLowerCase().includes("not available");
}
