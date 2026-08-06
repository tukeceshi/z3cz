import type { AiModelInvocation } from "./platform-ai-model";

export type ApiInterfaceRequestLogOperation =
  | "submit"
  | "poll"
  | "download"
  | "cancel";

/** One upstream HTTP call against an org AI interface. */
export interface ApiInterfaceRequestLog {
  readonly id: string;
  readonly organizationId: string;
  readonly interfaceId: string | null;
  readonly invocationId: string | null;
  readonly generationJobId: string | null;
  readonly operation: ApiInterfaceRequestLogOperation | null;
  readonly method: string;
  readonly url: string;
  readonly httpStatus: number | null;
  readonly durationMs: number | null;
  readonly upstreamRequestId: string | null;
  readonly requestBody: Record<string, unknown> | null;
  readonly responseExcerpt: string | null;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface AiModelInvocationDetailResponse {
  readonly invocation: AiModelInvocation;
  readonly apiLogs: readonly ApiInterfaceRequestLog[];
}
