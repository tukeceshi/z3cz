import { and, asc, eq } from "drizzle-orm";
import type {
  ApiInterfaceRequestLog,
  ApiInterfaceRequestLogOperation,
} from "@dafthunk/types";

import type { Database } from "./index";
import { apiInterfaceRequestLogs } from "./schema";

function mapRow(
  row: typeof apiInterfaceRequestLogs.$inferSelect
): ApiInterfaceRequestLog {
  return {
    id: row.id,
    organizationId: row.organizationId,
    interfaceId: row.interfaceId,
    invocationId: row.invocationId,
    generationJobId: row.generationJobId,
    operation: row.operation as ApiInterfaceRequestLogOperation | null,
    method: row.method,
    url: row.url,
    httpStatus: row.httpStatus,
    durationMs: row.durationMs,
    upstreamRequestId: row.upstreamRequestId,
    requestBody: row.requestBody ?? null,
    responseExcerpt: row.responseExcerpt,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createApiInterfaceRequestLog(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly interfaceId?: string | null;
    readonly invocationId?: string | null;
    readonly generationJobId?: string | null;
    readonly operation?: ApiInterfaceRequestLogOperation | null;
    readonly method: string;
    readonly url: string;
    readonly httpStatus?: number | null;
    readonly durationMs?: number | null;
    readonly upstreamRequestId?: string | null;
    readonly requestBody?: Record<string, unknown> | null;
    readonly responseExcerpt?: string | null;
    readonly error?: string | null;
  }
): Promise<void> {
  await db.insert(apiInterfaceRequestLogs).values({
    id: params.id,
    organizationId: params.organizationId,
    interfaceId: params.interfaceId ?? null,
    invocationId: params.invocationId ?? null,
    generationJobId: params.generationJobId ?? null,
    operation: params.operation ?? null,
    method: params.method,
    url: params.url,
    httpStatus: params.httpStatus ?? null,
    durationMs: params.durationMs ?? null,
    upstreamRequestId: params.upstreamRequestId ?? null,
    requestBody: params.requestBody ?? null,
    responseExcerpt: params.responseExcerpt ?? null,
    error: params.error ?? null,
  });
}

export async function listApiInterfaceRequestLogsByInvocationId(
  db: Database,
  params: {
    readonly organizationId?: string;
    readonly invocationId: string;
  }
): Promise<readonly ApiInterfaceRequestLog[]> {
  const rows = await db
    .select()
    .from(apiInterfaceRequestLogs)
    .where(
      params.organizationId
        ? and(
            eq(apiInterfaceRequestLogs.organizationId, params.organizationId),
            eq(apiInterfaceRequestLogs.invocationId, params.invocationId)
          )
        : eq(apiInterfaceRequestLogs.invocationId, params.invocationId)
    )
    .orderBy(asc(apiInterfaceRequestLogs.createdAt));

  return rows.map(mapRow);
}
