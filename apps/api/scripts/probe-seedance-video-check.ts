/**
 * Probe CreateArkOfficialResultQuery / GetArkOfficialResult with the documented body.
 *
 * Run inside api container:
 *   pnpm exec tsx scripts/probe-seedance-video-check.ts "<video-url>" [organizationId]
 *
 * Documented request:
 *   { "Type": "content_url", "ContentURL": "<public media url>" }
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import type { VolcengineCredentials } from "../src/integrations/volcengine/client";
import {
  VOLCANO_ARK_API_VERSION,
  VOLCANO_ARK_HOST,
  VOLCANO_ARK_SERVICE,
  VOLCANO_DEFAULT_PROJECT_NAME,
  VOLCANO_DEFAULT_REGION,
} from "../src/integrations/volcengine/constants";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

interface RawCallResult {
  readonly httpStatus: number;
  readonly payload: Record<string, unknown>;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

function loadDevVars(): void {
  const paths = [
    process.env.SECRETS_FILE,
    process.env.DEV_VARS_FILE,
    resolve(process.cwd(), ".dev.vars"),
  ].filter((value): value is string => Boolean(value));

  for (const devVarsPath of paths) {
    if (!existsSync(devVarsPath)) continue;
    for (const line of readFileSync(devVarsPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      if (!process.env[key]) {
        process.env[key] = trimmed.slice(separatorIndex + 1).trim();
      }
    }
  }
}

function normalizeVideoUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\\u0026/gi, "&")
    .replace(/\\&/g, "&")
    .replace(/\\+$/, "");
}

function readError(payload: Record<string, unknown>): {
  code: string | null;
  message: string | null;
} {
  const metadata = payload.ResponseMetadata;
  if (!metadata || typeof metadata !== "object") {
    return { code: null, message: null };
  }
  const error = (metadata as { Error?: { Code?: unknown; Message?: unknown } })
    .Error;
  return {
    code: typeof error?.Code === "string" ? error.Code : null,
    message: typeof error?.Message === "string" ? error.Message : null,
  };
}

function readQueryId(payload: Record<string, unknown>): string | null {
  const result = payload.Result;
  const sources: unknown[] = [payload, result];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const record = source as Record<string, unknown>;
    for (const key of ["QueryID", "QueryId", "queryId"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function isBillingInactive(result: RawCallResult): boolean {
  return (
    result.errorCode === "OperationDenied.BillingNotActive" ||
    Boolean(result.errorMessage?.includes("bill is not active"))
  );
}

async function callRaw(params: {
  readonly credentials: VolcengineCredentials;
  readonly action: string;
  readonly body?: Record<string, unknown>;
}): Promise<RawCallResult> {
  const signed = await signVolcengineRequest({
    accessKeyId: params.credentials.accessKeyId.trim(),
    secretAccessKey: params.credentials.secretAccessKey.trim(),
    region: params.credentials.region ?? VOLCANO_DEFAULT_REGION,
    service: VOLCANO_ARK_SERVICE,
    host: VOLCANO_ARK_HOST,
    method: "POST",
    action: params.action,
    version: VOLCANO_ARK_API_VERSION,
    body: params.body,
  });

  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  const error = readError(payload);
  return {
    httpStatus: response.status,
    payload,
    errorCode: error.code,
    errorMessage: error.message,
  };
}

function printCall(label: string, result: RawCallResult): void {
  console.log(`\n=== ${label} ===`);
  console.log(`HTTP ${result.httpStatus}`);
  console.log(`errorCode=${result.errorCode ?? "none"}`);
  console.log(`errorMessage=${result.errorMessage ?? "none"}`);
  console.log(JSON.stringify(result.payload, null, 2));
}

async function main(): Promise<void> {
  loadDevVars();

  const videoUrl = normalizeVideoUrl(process.argv[2] ?? "");
  const orgFilter = process.argv[3]?.trim();
  const existingQueryId = process.argv[4]?.trim();
  if (!videoUrl && !existingQueryId) {
    throw new Error(
      "Usage: pnpm exec tsx scripts/probe-seedance-video-check.ts <video-url> [organizationId] [queryId]"
    );
  }
  if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY) {
    throw new Error("DATABASE_URL and SECRET_MASTER_KEY are required");
  }

  console.log("videoUrl:", videoUrl);

  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL });
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.provider, "doubao_volcano"));

  const candidates = orgFilter
    ? rows.filter((row) => row.organizationId === orgFilter)
    : rows;
  if (candidates.length === 0) {
    throw new Error("No doubao_volcano AI interface found");
  }

  let credentials: VolcengineCredentials | null = null;
  let organizationId = "";

  for (const row of candidates) {
    const next = await getVolcanoCredentials(
      process.env as never,
      row.organizationId,
      row.metadata
    );
    if (!next) {
      console.log(`skip org=${row.organizationId}: cannot decrypt credentials`);
      continue;
    }

    credentials = next;
    organizationId = row.organizationId;
    break;
  }

  if (!credentials) {
    throw new Error("No usable Volcano credentials");
  }

  console.log(`Using org=${organizationId}`);

  let queryId = existingQueryId || null;
  if (!queryId) {
    const createBody = {
      Type: "content_url",
      ContentURL: videoUrl,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    };
    let created = await callRaw({
      credentials,
      action: "CreateArkOfficialResultQuery",
      body: createBody,
    });
    printCall("CreateArkOfficialResultQuery documented body", created);

    if (isBillingInactive(created) && !orgFilter) {
      const remaining = candidates.filter(
        (row) => row.organizationId !== organizationId
      );
      for (const row of remaining) {
        const next = await getVolcanoCredentials(
          process.env as never,
          row.organizationId,
          row.metadata
        );
        if (!next) continue;
        credentials = next;
        organizationId = row.organizationId;
        console.log(`retry with org=${organizationId}`);
        await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
        created = await callRaw({
          credentials,
          action: "CreateArkOfficialResultQuery",
          body: createBody,
        });
        printCall("CreateArkOfficialResultQuery documented body", created);
        if (!isBillingInactive(created)) break;
      }
    }

    queryId = readQueryId(created.payload);
  }

  if (!queryId) {
    throw new Error("CreateArkOfficialResultQuery did not return QueryID");
  }

  console.log("\n=== QUERY ID ===");
  console.log(queryId);

  const result = await callRaw({
    credentials,
    action: "GetArkOfficialResult",
    body: {
      QueryID: queryId,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
  });
  printCall("GetArkOfficialResult", result);
}

void main();
