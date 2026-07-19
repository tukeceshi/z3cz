export const CREATE_NEW_TOS_BUCKET = "__create_new__";

/** Default bucket name when user chooses to create a new TOS bucket. */
export const DEFAULT_NEW_TOS_BUCKET_NAME = "z3cz-com";

export function resolveNewTosBucketName(
  existingBuckets: readonly string[]
): string {
  if (!existingBuckets.includes(DEFAULT_NEW_TOS_BUCKET_NAME)) {
    return DEFAULT_NEW_TOS_BUCKET_NAME;
  }

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${DEFAULT_NEW_TOS_BUCKET_NAME}-${suffix}`;
    if (!existingBuckets.includes(candidate)) {
      return candidate;
    }
  }

  return `${DEFAULT_NEW_TOS_BUCKET_NAME}-${Date.now().toString(36)}`;
}
