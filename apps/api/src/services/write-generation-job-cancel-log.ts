import type { GenerationJobRecord } from "@dafthunk/types";

import type { Database } from "../db";
import { createApiInterfaceRequestLog } from "../db/api-interface-request-log-queries";

export async function writeGenerationJobCancelLog(
  db: Database,
  job: GenerationJobRecord
): Promise<void> {
  try {
    await createApiInterfaceRequestLog(db, {
      id: crypto.randomUUID(),
      organizationId: job.organizationId,
      interfaceId: job.interfaceId,
      invocationId: job.resultJson?.invocationId ?? null,
      generationJobId: job.id,
      operation: "cancel",
      method: "LOCAL",
      url: "generation-job/cancel",
      httpStatus: 200,
      durationMs: 0,
      responseExcerpt: "Generation cancelled",
    });
  } catch (error) {
    console.error("[api-interface-log] failed to persist cancel log", error);
  }
}
