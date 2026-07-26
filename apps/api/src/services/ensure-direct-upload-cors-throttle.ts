const ENSURE_CORS_THROTTLE_MS = 300_000;

const lastEnsureAtByKey = new Map<string, number>();

export function shouldThrottleDirectUploadCorsEnsure(
  organizationId: string,
  origin: string
): boolean {
  const key = `${organizationId}:${origin}`;
  const last = lastEnsureAtByKey.get(key);
  if (last !== undefined && Date.now() - last < ENSURE_CORS_THROTTLE_MS) {
    return true;
  }
  lastEnsureAtByKey.set(key, Date.now());
  return false;
}
