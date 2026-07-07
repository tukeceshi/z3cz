/** Node.js shim for `cloudflare:workflows` — Workers-only at deploy time. */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}
