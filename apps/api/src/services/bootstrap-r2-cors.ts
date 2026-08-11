import type { Bindings } from "../context";
import {
  mergeDirectUploadCorsOrigins,
  resolveDirectUploadCorsOrigins,
} from "./ensure-direct-upload-cors";
import type { BootstrapR2Credentials } from "./bootstrap-r2-client";
import {
  createAwsClient,
  buildR2Endpoint,
} from "./bootstrap-r2-client";

export interface R2CorsRule {
  readonly allowedOrigins: readonly string[];
  readonly allowedMethods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly exposeHeaders: readonly string[];
  readonly maxAgeSeconds: number;
}

const SHELL_ACCESS_METHODS = ["GET", "HEAD"] as const;
const SHELL_ACCESS_HEADERS = ["*"] as const;
const SHELL_EXPOSE_HEADERS = ["ETag", "Content-Length"] as const;

export function resolveBootstrapShellCorsOrigins(
  env: Pick<Bindings, "WEB_HOST" | "WEBSITE_URL">
): readonly string[] {
  return resolveDirectUploadCorsOrigins(env);
}

function buildBucketCorsUrl(credentials: BootstrapR2Credentials): string {
  return `${buildR2Endpoint(credentials)}/${credentials.bucketName.trim()}?cors`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildR2CorsConfigurationXml(
  rules: readonly R2CorsRule[]
): string {
  const ruleBlocks = rules
    .map((rule) => {
      const origins = rule.allowedOrigins
        .map(
          (origin) =>
            `<AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>`
        )
        .join("");
      const methods = rule.allowedMethods
        .map(
          (method) =>
            `<AllowedMethod>${escapeXml(method)}</AllowedMethod>`
        )
        .join("");
      const headers = rule.allowedHeaders
        .map(
          (header) =>
            `<AllowedHeader>${escapeXml(header)}</AllowedHeader>`
        )
        .join("");
      const exposeHeaders = rule.exposeHeaders
        .map(
          (header) =>
            `<ExposeHeader>${escapeXml(header)}</ExposeHeader>`
        )
        .join("");
      return `<CORSRule>${origins}${methods}${headers}${exposeHeaders}<MaxAgeSeconds>${rule.maxAgeSeconds}</MaxAgeSeconds></CORSRule>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration>${ruleBlocks}</CORSConfiguration>`;
}

function readXmlValues(block: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");
  const values: string[] = [];
  for (const match of block.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value) {
      values.push(value);
    }
  }
  return values;
}

export function parseR2CorsConfigurationXml(xml: string): R2CorsRule[] {
  const rules: R2CorsRule[] = [];
  const rulePattern = /<CORSRule>([\s\S]*?)<\/CORSRule>/g;
  for (const match of xml.matchAll(rulePattern)) {
    const block = match[1] ?? "";
    const maxAgeRaw = readXmlValues(block, "MaxAgeSeconds")[0];
    const maxAgeSeconds = maxAgeRaw ? Number(maxAgeRaw) : 3600;
    rules.push({
      allowedOrigins: readXmlValues(block, "AllowedOrigin"),
      allowedMethods: readXmlValues(block, "AllowedMethod"),
      allowedHeaders: readXmlValues(block, "AllowedHeader"),
      exposeHeaders: readXmlValues(block, "ExposeHeader"),
      maxAgeSeconds: Number.isFinite(maxAgeSeconds) ? maxAgeSeconds : 3600,
    });
  }
  return rules.map((rule) => ({
    allowedOrigins: rule.allowedOrigins,
    allowedMethods: rule.allowedMethods,
    allowedHeaders: rule.allowedHeaders.length > 0 ? rule.allowedHeaders : ["*"],
    exposeHeaders: rule.exposeHeaders,
    maxAgeSeconds: rule.maxAgeSeconds,
  }));
}

function originMatchesRule(
  origin: string,
  allowedOrigins: readonly string[]
): boolean {
  return allowedOrigins.some(
    (allowed) => allowed === "*" || allowed === origin
  );
}

export function corsRulesAllowShellFetch(
  rules: readonly R2CorsRule[],
  requiredOrigins: readonly string[]
): boolean {
  if (requiredOrigins.length === 0) {
    return true;
  }

  return requiredOrigins.every((origin) =>
    rules.some(
      (rule) =>
        rule.allowedMethods.includes("GET") &&
        rule.allowedHeaders.includes("*") &&
        originMatchesRule(origin, rule.allowedOrigins)
    )
  );
}

export function mergeShellFetchRule(
  existing: readonly R2CorsRule[],
  shellRule: R2CorsRule
): R2CorsRule[] {
  const matchingIndex = existing.findIndex((rule) =>
    rule.allowedMethods.includes("GET")
  );

  if (matchingIndex < 0) {
    return [...existing, shellRule];
  }

  const current = existing[matchingIndex]!;
  const mergedRule: R2CorsRule = {
    allowedOrigins: [
      ...new Set([...current.allowedOrigins, ...shellRule.allowedOrigins]),
    ],
    allowedMethods: [
      ...new Set([...current.allowedMethods, ...shellRule.allowedMethods]),
    ],
    allowedHeaders: current.allowedHeaders.includes("*")
      ? [...SHELL_ACCESS_HEADERS]
      : [
          ...new Set([
            ...current.allowedHeaders,
            ...shellRule.allowedHeaders,
          ]),
        ],
    exposeHeaders: [
      ...new Set([...current.exposeHeaders, ...shellRule.exposeHeaders]),
    ],
    maxAgeSeconds: Math.max(current.maxAgeSeconds, shellRule.maxAgeSeconds),
  };

  return existing.map((rule, index) =>
    index === matchingIndex ? mergedRule : rule
  );
}

export async function getR2BucketCors(
  credentials: BootstrapR2Credentials
): Promise<R2CorsRule[]> {
  const client = createAwsClient(credentials);
  const response = await client.fetch(buildBucketCorsUrl(credentials), {
    method: "GET",
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 read CORS failed (${response.status}): ${body}`
        : `R2 read CORS failed (${response.status})`
    );
  }

  const xml = await response.text();
  return parseR2CorsConfigurationXml(xml);
}

export async function putR2BucketCors(
  credentials: BootstrapR2Credentials,
  rules: readonly R2CorsRule[]
): Promise<void> {
  const client = createAwsClient(credentials);
  const response = await client.fetch(buildBucketCorsUrl(credentials), {
    method: "PUT",
    body: buildR2CorsConfigurationXml(rules),
    headers: {
      "Content-Type": "application/xml",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 update CORS failed (${response.status}): ${body}`
        : `R2 update CORS failed (${response.status})`
    );
  }
}

export async function ensureBootstrapR2ShellCors(params: {
  readonly credentials: BootstrapR2Credentials;
  readonly allowedOrigins: readonly string[];
}): Promise<{ readonly applied: boolean; readonly origins: readonly string[] }> {
  if (params.allowedOrigins.length === 0) {
    return { applied: false, origins: [] };
  }

  const shellRule: R2CorsRule = {
    allowedOrigins: params.allowedOrigins,
    allowedMethods: [...SHELL_ACCESS_METHODS],
    allowedHeaders: [...SHELL_ACCESS_HEADERS],
    exposeHeaders: [...SHELL_EXPOSE_HEADERS],
    maxAgeSeconds: 3600,
  };

  const existing = await getR2BucketCors(params.credentials);
  if (corsRulesAllowShellFetch(existing, params.allowedOrigins)) {
    return { applied: false, origins: params.allowedOrigins };
  }

  const merged = mergeShellFetchRule(existing, shellRule);
  await putR2BucketCors(params.credentials, merged);
  return { applied: true, origins: params.allowedOrigins };
}

export async function ensureBootstrapR2ShellCorsFromEnv(params: {
  readonly credentials: BootstrapR2Credentials;
  readonly env: Pick<Bindings, "WEB_HOST" | "WEBSITE_URL">;
}): Promise<{ readonly applied: boolean; readonly origins: readonly string[] }> {
  const origins = mergeDirectUploadCorsOrigins(params.env);
  return ensureBootstrapR2ShellCors({
    credentials: params.credentials,
    allowedOrigins: origins,
  });
}
