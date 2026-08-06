import type { ApiInterfaceRequestLogOperation } from "@dafthunk/types";
import type { UpstreamRequestLogSink } from "@dafthunk/runtime/ai-interface/upstream-request-log";

import type { Database } from "../db";
import { createApiInterfaceRequestLog } from "../db/api-interface-request-log-queries";

export function createUpstreamRequestLogger(
  db: Database,
  context: {
    readonly organizationId: string;
    readonly interfaceId?: string | null;
    readonly invocationId?: string | null;
    readonly generationJobId?: string | null;
    readonly operation: ApiInterfaceRequestLogOperation;
  }
): UpstreamRequestLogSink {
  return async (record) => {
    try {
      await createApiInterfaceRequestLog(db, {
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        interfaceId: context.interfaceId,
        invocationId: context.invocationId,
        generationJobId: context.generationJobId,
        operation: context.operation,
        method: record.method,
        url: record.url,
        httpStatus: record.httpStatus,
        durationMs: record.durationMs,
        upstreamRequestId: record.upstreamRequestId,
        requestBody: record.requestBody,
        responseExcerpt: record.responseExcerpt,
        error: record.error,
      });
    } catch (error) {
      console.error("[api-interface-log] failed to persist upstream log", error);
    }
  };
}
