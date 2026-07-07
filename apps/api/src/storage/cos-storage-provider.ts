export interface CosStorageConfig {
  readonly secretId: string;
  readonly secretKey: string;
  readonly bucket: string;
  readonly region: string;
  readonly endpoint?: string;
}

export function readCosStorageConfig(
  env: Record<string, string>
): CosStorageConfig | null {
  const secretId = env.COS_SECRET_ID?.trim();
  const secretKey = env.COS_SECRET_KEY?.trim();
  const bucket = env.COS_BUCKET?.trim();
  const region = env.COS_REGION?.trim();

  if (!secretId || !secretKey || !bucket || !region || secretId === "CHANGE_ME") {
    return null;
  }

  return {
    secretId,
    secretKey,
    bucket,
    region,
    endpoint: env.COS_ENDPOINT?.trim(),
  };
}

/**
 * Tencent COS adapter — not implemented yet.
 * Future path: load org-level COS credentials from admin settings and return CosR2Bucket wrappers.
 */
export async function createCosStorageBuckets(
  _config: CosStorageConfig
): Promise<never> {
  throw new Error(
    "Tencent COS storage is not implemented yet. Unset COS_* env vars to use LOCAL_STORAGE_PATH, or wait for admin-configured COS support."
  );
}
