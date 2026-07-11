import type {
  NodeExecution,
  ParameterValue,
  UpstreamPollContinuation,
} from "@dafthunk/types";

import type { NodeContext } from "../../node-types";
import { awaitReplicatePrediction } from "../../upstream/replicate-upstream";
import { buildUpstreamPollRuntimeContext } from "../../upstream/upstream-poll-router";

/** Cap blocking polls in WorkerRuntime where async continuations are unavailable. */
const MAX_WORKER_BLOCKING_MS = 5 * 60 * 1000;

function clampContinuationTimeout(
  continuation: UpstreamPollContinuation
): UpstreamPollContinuation {
  const deadline = Date.parse(continuation.timeoutAt);
  const cappedDeadline = Math.min(deadline, Date.now() + MAX_WORKER_BLOCKING_MS);
  if (cappedDeadline === deadline) {
    return continuation;
  }
  return {
    ...continuation,
    timeoutAt: new Date(cappedDeadline).toISOString(),
  };
}

/**
 * When the runtime supports durable async (heartbeat), return pending.
 * Otherwise block-poll until the Replicate prediction finishes (Worker path /
 * single-node execute).
 */
export async function awaitReplicateOrPending(params: {
  context: NodeContext;
  continuation: UpstreamPollContinuation;
  token: string;
  timeoutLabel: string;
  nodeOutputs: ReadonlyArray<{
    name: string;
    type: string;
    repeated?: boolean;
  }>;
  createSuccessResult: (
    outputs: Record<string, ParameterValue>,
    usage?: number
  ) => NodeExecution;
  createErrorResult: (error: string, usage?: number) => NodeExecution;
}): Promise<NodeExecution> {
  const {
    context,
    continuation,
    token,
    timeoutLabel,
    nodeOutputs,
    createSuccessResult,
    createErrorResult,
  } = params;

  if (context.asyncSupported) {
    return {
      nodeId: context.nodeId,
      status: "pending",
      usage: 0,
      pendingEvent: {
        type: `upstream-poll-${continuation.taskId}`,
        timeout: timeoutLabel,
      },
      pendingContinuation: continuation,
    };
  }

  if (!context.objectStore || !context.executionId) {
    return createErrorResult(
      "Object store / execution context is required for blocking Replicate poll."
    );
  }

  const result = await awaitReplicatePrediction({
    continuation: clampContinuationTimeout(continuation),
    token,
    runtimeContext: buildUpstreamPollRuntimeContext({
      objectStore: context.objectStore,
      organizationId: context.organizationId,
      executionId: context.executionId,
      env: context.env,
      nodeOutputs,
    }),
  });

  if (result.status === "failed") {
    return createErrorResult(result.error, result.usage);
  }

  if (result.status === "pending") {
    return createErrorResult("Replicate prediction did not complete in time");
  }

  return createSuccessResult(
    result.outputs as Record<string, ParameterValue>,
    result.usage
  );
}
