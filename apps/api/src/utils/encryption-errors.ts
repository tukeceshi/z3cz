export const CREDENTIALS_DECRYPT_FAILED = "CREDENTIALS_DECRYPT_FAILED" as const;

export class DecryptionFailedError extends Error {
  readonly code = CREDENTIALS_DECRYPT_FAILED;

  constructor() {
    super(
      "Stored credentials cannot be decrypted with the current SECRET_MASTER_KEY. Re-enter credentials or restore the original master key."
    );
    this.name = "DecryptionFailedError";
  }
}

export function isDecryptionFailure(error: unknown): boolean {
  if (error instanceof DecryptionFailedError) {
    return true;
  }
  return error instanceof DOMException && error.name === "OperationError";
}
