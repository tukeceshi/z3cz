/** Prefix for auto-created TOS buckets. Names must be globally unique across all users. */
export const VOLCANO_TOS_NEW_BUCKET_PREFIX = "z3cz-com";

const TOS_BUCKET_MAX_LENGTH = 63;
const TOS_BUCKET_MIN_LENGTH = 3;

function sanitizeOrganizationIdForBucket(organizationId: string): string {
  const normalized = organizationId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized.slice(0, 12) || "org";
}

function randomBucketToken(length: number): string {
  let token = "";
  while (token.length < length) {
    token += Math.random().toString(36).slice(2);
  }
  return token.slice(0, length);
}

function normalizeTosBucketName(candidate: string): string {
  const lowered = candidate.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const trimmed = lowered.replace(/^-+|-+$/g, "").slice(0, TOS_BUCKET_MAX_LENGTH);
  if (trimmed.length < TOS_BUCKET_MIN_LENGTH) {
    return `${VOLCANO_TOS_NEW_BUCKET_PREFIX}-${randomBucketToken(8)}`;
  }
  return trimmed;
}

export function buildVolcanoTosBucketNameCandidate(
  organizationId: string,
  suffix?: string
): string {
  const orgPart = sanitizeOrganizationIdForBucket(organizationId);
  const unique = suffix ?? randomBucketToken(8);
  return normalizeTosBucketName(
    `${VOLCANO_TOS_NEW_BUCKET_PREFIX}-${orgPart}-${unique}`
  );
}

export function resolveNewVolcanoTosBucketName(
  existingBuckets: readonly string[],
  organizationId: string
): string {
  const occupied = new Set(existingBuckets.map((bucket) => bucket.toLowerCase()));

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = buildVolcanoTosBucketNameCandidate(
      organizationId,
      attempt === 0 ? undefined : randomBucketToken(8)
    );
    if (!occupied.has(candidate)) {
      return candidate;
    }
  }

  return buildVolcanoTosBucketNameCandidate(
    organizationId,
    `${Date.now().toString(36)}${randomBucketToken(4)}`
  );
}
