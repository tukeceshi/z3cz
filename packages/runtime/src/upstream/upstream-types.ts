import type { UpstreamPollContinuation } from "@dafthunk/types";

export type UpstreamPollStatus = "pending" | "completed" | "failed";

export interface UpstreamPollPendingResult {
  readonly status: "pending";
  readonly nextPollAt: string;
}

export interface UpstreamPollCompletedResult {
  readonly status: "completed";
  readonly outputs: Record<string, unknown>;
  readonly usage: number;
}

export interface UpstreamPollFailedResult {
  readonly status: "failed";
  readonly error: string;
  readonly usage?: number;
}

export type UpstreamPollResult =
  | UpstreamPollPendingResult
  | UpstreamPollCompletedResult
  | UpstreamPollFailedResult;

export interface UpstreamPollRuntimeContext {
  readonly objectStore: import("../object-store").ObjectStore;
  readonly organizationId: string;
  readonly executionId: string;
  readonly env: import("../node-types").NodeEnv;
  readonly relayAccountService?: import("../relay-account-service").RelayAccountService;
  readonly nodeOutputs: ReadonlyArray<{
    readonly name: string;
    readonly type: string;
    readonly repeated?: boolean;
  }>;
}

export interface UpstreamPollProvider {
  readonly provider: string;
  poll(
    continuation: UpstreamPollContinuation,
    context: UpstreamPollRuntimeContext
  ): Promise<UpstreamPollResult>;
}

export function reschedulePollContinuation(
  continuation: UpstreamPollContinuation,
  nextPollAt: Date
): UpstreamPollContinuation {
  return {
    ...continuation,
    nextPollAt: nextPollAt.toISOString(),
  };
}

export function upstreamPollContinuation(params: {
  nodeId: string;
  provider: string;
  taskId: string;
  pollUrl: string;
  pollIntervalMs: number;
  timeoutAt: string;
  metadata?: Readonly<Record<string, string>>;
  now?: Date;
  nextPollAt?: string;
}): UpstreamPollContinuation {
  const now = params.now ?? new Date();
  return {
    kind: "upstream_poll",
    nodeId: params.nodeId,
    provider: params.provider,
    taskId: params.taskId,
    pollUrl: params.pollUrl,
    pollIntervalMs: params.pollIntervalMs,
    nextPollAt:
      params.nextPollAt ??
      new Date(now.getTime() + params.pollIntervalMs).toISOString(),
    timeoutAt: params.timeoutAt,
    createdAt: now.toISOString(),
    metadata: params.metadata,
    profileId: params.metadata?.profileId,
  };
}

export function resolvePollTimeout(
  continuation: UpstreamPollContinuation,
  now: Date
): UpstreamPollFailedResult | null {
  if (Date.parse(continuation.timeoutAt) > now.getTime()) {
    return null;
  }

  return {
    status: "failed",
    error: `Upstream task "${continuation.taskId}" timed out`,
  };
}
