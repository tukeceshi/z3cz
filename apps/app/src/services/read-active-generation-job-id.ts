import { ApiRequestError } from "@/services/utils";

export function readActiveGenerationJobId(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) {
    return undefined;
  }
  if (error.code !== "active_generation_job_exists" || !error.jobId) {
    return undefined;
  }
  return error.jobId;
}
