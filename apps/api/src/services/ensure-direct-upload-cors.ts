import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  getBucketCors,
  putBucketCors,
  type TosCorsRule,
  type VolcengineTosBucketCredentials,
} from "../integrations/volcengine/tos-sdk-cors";
import { decryptSecret } from "../utils/encryption";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

export type { TosCorsRule } from "../integrations/volcengine/tos-sdk-cors";

const DIRECT_UPLOAD_METHODS = ["PUT", "HEAD"] as const;
const DIRECT_UPLOAD_HEADERS = ["*"] as const;
const DIRECT_UPLOAD_EXPOSE_HEADERS = ["ETag", "x-tos-request-id"] as const;

function normalizeCorsOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDirectUploadCorsOrigins(
  env: Pick<Bindings, "WEB_HOST" | "WEBSITE_URL">
): readonly string[] {
  const origins = new Set<string>();
  const addOrigin = (value: string | undefined): void => {
    if (!value) return;
    const normalized = normalizeCorsOrigin(value);
    if (normalized) origins.add(normalized);
  };

  addOrigin(env.WEB_HOST);
  addOrigin(env.WEBSITE_URL);

  if (env.WEB_HOST?.includes("localhost")) {
    addOrigin("http://localhost:3101");
    addOrigin("http://127.0.0.1:3101");
  }

  return [...origins];
}

export function mergeDirectUploadCorsOrigins(
  env: Pick<Bindings, "WEB_HOST" | "WEBSITE_URL">,
  extraOrigins?: readonly string[]
): readonly string[] {
  const origins = new Set(resolveDirectUploadCorsOrigins(env));
  for (const origin of extraOrigins ?? []) {
    const normalized = normalizeCorsOrigin(origin);
    if (normalized) origins.add(normalized);
  }
  return [...origins];
}

function originMatchesRule(
  origin: string,
  allowedOrigins: readonly string[]
): boolean {
  return allowedOrigins.some(
    (allowed) => allowed === "*" || allowed === origin
  );
}

export function corsRulesAllowDirectUpload(
  rules: readonly TosCorsRule[],
  requiredOrigins: readonly string[]
): boolean {
  if (requiredOrigins.length === 0) {
    return true;
  }

  return requiredOrigins.every((origin) =>
    rules.some(
      (rule) =>
        rule.allowedMethods.includes("PUT") &&
        originMatchesRule(origin, rule.allowedOrigins)
    )
  );
}

function mergeDirectUploadRule(
  existing: readonly TosCorsRule[],
  directUploadRule: TosCorsRule
): TosCorsRule[] {
  const matchingIndex = existing.findIndex((rule) =>
    rule.allowedMethods.includes("PUT")
  );

  if (matchingIndex < 0) {
    return [...existing, directUploadRule];
  }

  const current = existing[matchingIndex]!;
  const mergedOrigins = [
    ...new Set([...current.allowedOrigins, ...directUploadRule.allowedOrigins]),
  ];
  const mergedMethods = [
    ...new Set([...current.allowedMethods, ...directUploadRule.allowedMethods]),
  ];
  const mergedHeaders = current.allowedHeaders.includes("*")
    ? [...DIRECT_UPLOAD_HEADERS]
    : [
        ...new Set([
          ...current.allowedHeaders,
          ...directUploadRule.allowedHeaders,
        ]),
      ];
  const mergedExposeHeaders = [
    ...new Set([
      ...current.exposeHeaders,
      ...directUploadRule.exposeHeaders,
    ]),
  ];

  const mergedRule: TosCorsRule = {
    allowedOrigins: mergedOrigins,
    allowedMethods: mergedMethods,
    allowedHeaders: mergedHeaders,
    exposeHeaders: mergedExposeHeaders,
    maxAgeSeconds: Math.max(
      current.maxAgeSeconds,
      directUploadRule.maxAgeSeconds
    ),
  };

  return existing.map((rule, index) =>
    index === matchingIndex ? mergedRule : rule
  );
}

export async function ensureDirectUploadCors(params: {
  readonly credentials: VolcengineTosBucketCredentials;
  readonly allowedOrigins: readonly string[];
}): Promise<{ readonly applied: boolean }> {
  const directUploadRule: TosCorsRule = {
    allowedOrigins: params.allowedOrigins,
    allowedMethods: [...DIRECT_UPLOAD_METHODS],
    allowedHeaders: [...DIRECT_UPLOAD_HEADERS],
    exposeHeaders: [...DIRECT_UPLOAD_EXPOSE_HEADERS],
    maxAgeSeconds: 3600,
    responseVary: false,
  };

  const existing = await getBucketCors(params.credentials);
  if (corsRulesAllowDirectUpload(existing, params.allowedOrigins)) {
    return { applied: false };
  }

  const merged = mergeDirectUploadRule(existing, directUploadRule);
  await putBucketCors(params.credentials, merged);
  return { applied: true };
}

async function resolveOrgTosBucketCredentials(
  env: Bindings,
  organizationId: string
): Promise<VolcengineTosBucketCredentials | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }

  const secretAccessKey = await decryptSecret(
    cloud.secretAccessKeyEncrypted,
    env,
    organizationId
  );

  return {
    accessKeyId: cloud.accessKeyId,
    secretAccessKey,
    region: cloud.tosStorage.region,
    bucket: cloud.tosStorage.bucket,
  };
}

export async function ensureOrgDirectUploadCors(
  env: Bindings,
  organizationId: string,
  options?: { readonly extraOrigins?: readonly string[] }
): Promise<{ readonly applied: boolean; readonly origins: readonly string[] }> {
  const credentials = await resolveOrgTosBucketCredentials(env, organizationId);
  if (!credentials) {
    return { applied: false, origins: [] };
  }

  const origins = mergeDirectUploadCorsOrigins(env, options?.extraOrigins);
  if (origins.length === 0) {
    return { applied: false, origins };
  }

  const result = await ensureDirectUploadCors({
    credentials,
    allowedOrigins: origins,
  });
  return { ...result, origins };
}

export async function readOrgDirectUploadCorsStatus(
  env: Bindings,
  organizationId: string
): Promise<{
  readonly configured: boolean;
  readonly origins: readonly string[];
}> {
  const credentials = await resolveOrgTosBucketCredentials(env, organizationId);
  if (!credentials) {
    return { configured: false, origins: [] };
  }

  const origins = resolveDirectUploadCorsOrigins(env);
  const rules = await getBucketCors(credentials);
  return {
    configured: corsRulesAllowDirectUpload(rules, origins),
    origins,
  };
}
