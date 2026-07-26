import TOS, { HttpMethodType, TosServerError } from "@volcengine/tos-sdk";

import { TosRequestError } from "./tos-errors";

const TOS_NO_SUCH_CORS_CONFIGURATION = "NoSuchCORSConfiguration";

export interface TosCorsRule {
  readonly allowedOrigins: readonly string[];
  readonly allowedMethods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly exposeHeaders: readonly string[];
  readonly maxAgeSeconds: number;
  readonly responseVary?: boolean;
}

export interface VolcengineTosBucketCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly bucket: string;
}

function throwTosSdkError(error: unknown, action: string): never {
  if (error instanceof TosServerError) {
    throw new TosRequestError({
      message: `TOS ${action} failed (${error.statusCode}): ${error.message}`,
      httpStatus: error.statusCode,
      tosCode: error.code ?? null,
    });
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(`TOS ${action} failed`);
}

function createTosClient(
  credentials: VolcengineTosBucketCredentials
): InstanceType<typeof TOS> {
  return new TOS({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.secretAccessKey,
    region: credentials.region,
  });
}

function toSdkCorsRule(rule: TosCorsRule): {
  AllowedOrigins: string[];
  AllowedMethods: HttpMethodType[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
  ResponseVary?: boolean;
} {
  return {
    AllowedOrigins: [...rule.allowedOrigins],
    AllowedMethods: [...rule.allowedMethods] as HttpMethodType[],
    AllowedHeaders: [...rule.allowedHeaders],
    ExposeHeaders: [...rule.exposeHeaders],
    MaxAgeSeconds: rule.maxAgeSeconds,
    ...(rule.responseVary === undefined
      ? {}
      : { ResponseVary: rule.responseVary }),
  };
}

function fromSdkCorsRule(rule: {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
  ResponseVary?: boolean;
}): TosCorsRule {
  return {
    allowedOrigins: rule.AllowedOrigins,
    allowedMethods: rule.AllowedMethods,
    allowedHeaders: rule.AllowedHeaders,
    exposeHeaders: rule.ExposeHeaders,
    maxAgeSeconds: rule.MaxAgeSeconds,
    responseVary: rule.ResponseVary,
  };
}

export async function getBucketCors(
  credentials: VolcengineTosBucketCredentials
): Promise<readonly TosCorsRule[]> {
  const client = createTosClient(credentials);

  try {
    const response = await client.getBucketCORS({ bucket: credentials.bucket });
    return (response.data.CORSRules ?? []).map(fromSdkCorsRule);
  } catch (error) {
    if (
      error instanceof TosServerError &&
      (error.code === TOS_NO_SUCH_CORS_CONFIGURATION || error.statusCode === 404)
    ) {
      return [];
    }
    throwTosSdkError(error, "get bucket cors");
  }
}

export async function putBucketCors(
  credentials: VolcengineTosBucketCredentials,
  rules: readonly TosCorsRule[]
): Promise<void> {
  const client = createTosClient(credentials);

  try {
    await client.putBucketCORS({
      bucket: credentials.bucket,
      CORSRules: rules.map(toSdkCorsRule),
    });
  } catch (error) {
    throwTosSdkError(error, "put bucket cors");
  }
}
