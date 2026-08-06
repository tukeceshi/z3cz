import type { GenerationJobRecord, ApiInterfaceRequestLogOperation } from "@dafthunk/types";
import type { UpstreamRequestLogSink } from "@dafthunk/runtime/ai-interface/upstream-request-log";

import type { Database } from "../db";
import { createUpstreamRequestLogger } from "./create-upstream-request-logger";

export function createJobUpstreamRequestLogger(
  db: Database,
  job: GenerationJobRecord,
  operation: ApiInterfaceRequestLogOperation
): UpstreamRequestLogSink {
  return createUpstreamRequestLogger(db, {
    organizationId: job.organizationId,
    interfaceId: job.interfaceId,
    invocationId: job.resultJson?.invocationId ?? null,
    generationJobId: job.id,
    operation,
  });
}
