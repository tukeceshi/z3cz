/** Stable workflow media id — allocated once at creation, reused for cache and cloud object. */
export function allocateGenerativeMediaResourceId(): string {
  return crypto.randomUUID();
}
