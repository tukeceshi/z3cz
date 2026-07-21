import type { NodeExecution, ParameterValue, UpstreamPollContinuation } from "@dafthunk/types";

import type { NodeContext } from "../../node-types";
import {
  awaitVolcanoVideoPoll,
  createVolcanoVideoPollContinuation,
  downloadVolcanoVideo,
} from "../../ai-interface/execute-volcano-video";
import { buildUpstreamPollRuntimeContext } from "../../upstream/upstream-poll-router";

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

export async function awaitVolcanoVideoOrPending(params: {
  context: NodeContext;
  continuation: UpstreamPollContinuation;
  apiKey: string;
  timeoutLabel: string;
  storageMode: "ephemeral" | "cloud";
  cloudUpload?: import("../../ai-interface/execute-volcano-image").CloudImageUploadTarget;
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
    apiKey,
    timeoutLabel,
    storageMode,
    cloudUpload,
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
      "Object store / execution context is required for blocking video poll."
    );
  }

  const pollResult = await awaitVolcanoVideoPoll({
    apiKey,
    pollUrl: continuation.pollUrl,
    pollIntervalMs: continuation.pollIntervalMs,
    timeoutAt: clampContinuationTimeout(continuation).timeoutAt,
  });

  if (pollResult.status === "failed") {
    return createErrorResult(pollResult.error ?? "Video generation failed");
  }

  if (!pollResult.videoUrl) {
    return createErrorResult("Video generation completed without a URL");
  }

  const downloadResult = await downloadVolcanoVideo({
    videoUrl: pollResult.videoUrl,
    storageMode,
    objectStore: context.objectStore,
    organizationId: context.organizationId,
    workflowId: context.workflowId,
    executionId: context.executionId,
    cloudUpload,
  });

  if (downloadResult.status === "failed") {
    return createErrorResult(downloadResult.error ?? "Failed to store video");
  }

  const outputName = nodeOutputs[0]?.name ?? "videos";
  return createSuccessResult(
    { [outputName]: downloadResult.videos ?? [] },
    1
  );
}

export { createVolcanoVideoPollContinuation };
