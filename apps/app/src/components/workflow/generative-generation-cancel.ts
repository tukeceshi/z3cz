import type { CancelGenerationJobResponse } from "@dafthunk/types";
import { cancelGenerationJob, cancelGenerationJobByClientRequestId } from "@/services/platform-ai-model-service";

import {
  clearGenerativeProgress,
  isGenerativePhaseCancellable,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
  withGenerativeProgress,
} from "./generative-progress-utils";
import {
  withAiVideoGeneratingFlag,
} from "./ai-video-node-utils";

export class GenerativeGenerationCancelledError extends Error {
  constructor() {
    super("Generation cancelled");
    this.name = "GenerativeGenerationCancelledError";
  }
}

export class GenerativeGenerationCancelRejectedError extends Error {
  readonly response: CancelGenerationJobResponse | undefined;

  constructor(
    message = "Generation cancel was not confirmed",
    response?: CancelGenerationJobResponse
  ) {
    super(message);
    this.name = "GenerativeGenerationCancelRejectedError";
    this.response = response;
  }
}

export type GenerativeGenerationCancelResult =
  | {
      readonly kind: "pending";
    }
  | {
      readonly kind: "cancelled";
      readonly response: CancelGenerationJobResponse;
    }
  | {
      readonly kind: "completed";
      readonly response: CancelGenerationJobResponse;
    };

export function isGenerativeGenerationCancelled(error: unknown): boolean {
  if (error instanceof GenerativeGenerationCancelledError) {
    return true;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

export function isGenerativeGenerationCancelRejected(
  error: unknown
): error is GenerativeGenerationCancelRejectedError {
  return error instanceof GenerativeGenerationCancelRejectedError;
}

type GenerativeGenerationCancelHandler = () => void | Promise<void>;

const cancelHandlers = new Map<string, GenerativeGenerationCancelHandler>();
const nodeCancelled = new Map<string, boolean>();
const cancelledNoticeNodes = new Set<string>();
const cancelledNoticeListeners = new Set<() => void>();

function notifyCancelledNoticeListeners(): void {
  for (const listener of cancelledNoticeListeners) {
    listener();
  }
}

export function showGenerativeCancelledNotice(nodeId: string): void {
  cancelledNoticeNodes.add(nodeId);
  notifyCancelledNoticeListeners();
}

export function dismissGenerativeCancelledNotice(nodeId: string): void {
  if (!cancelledNoticeNodes.delete(nodeId)) {
    return;
  }
  notifyCancelledNoticeListeners();
}

export function isGenerativeCancelledNoticeVisible(nodeId: string): boolean {
  return cancelledNoticeNodes.has(nodeId);
}

export function subscribeGenerativeCancelledNotice(
  listener: () => void
): () => void {
  cancelledNoticeListeners.add(listener);
  return () => {
    cancelledNoticeListeners.delete(listener);
  };
}

export function resetNodeGenerationCancelled(nodeId: string): void {
  nodeCancelled.set(nodeId, false);
}

export function markNodeGenerationCancelled(nodeId: string): void {
  nodeCancelled.set(nodeId, true);
}

export function isNodeGenerationCancelled(nodeId: string): boolean {
  return nodeCancelled.get(nodeId) ?? false;
}

export function registerGenerativeGenerationCancel(
  nodeId: string,
  handler: GenerativeGenerationCancelHandler
): void {
  cancelHandlers.set(nodeId, handler);
}

export function unregisterGenerativeGenerationCancel(nodeId: string): void {
  cancelHandlers.delete(nodeId);
}

export async function invokeGenerativeGenerationCancel(
  nodeId: string
): Promise<boolean> {
  const handler = cancelHandlers.get(nodeId);
  if (!handler) {
    return false;
  }
  await handler();
  return true;
}

export async function cancelGenerativeGenerationForNode(params: {
  readonly nodeId: string;
  readonly orgId: string | undefined;
  readonly metadata: Record<string, string> | undefined;
  readonly modality: "video";
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: {
      readonly metadata?: Record<string, string>;
    }) => { readonly metadata?: Record<string, string> }
  ) => void;
}): Promise<void> {
  const phase = readGenerativeProgressPhase(params.metadata);
  if (!isGenerativePhaseCancellable(phase)) {
    return;
  }

  params.updateNodeData?.(params.nodeId, (current) => ({
    metadata: withGenerativeProgress(
      withAiVideoGeneratingFlag(current.metadata, true),
      { phase: "cancelling" }
    ),
  }));

  markNodeGenerationCancelled(params.nodeId);

  const invoked = await invokeGenerativeGenerationCancel(params.nodeId);
  if (invoked) {
    return;
  }

  const jobId = readGenerativeProgressJobId(params.metadata);
  if (jobId && params.orgId) {
    try {
      await cancelGenerationJob(params.orgId, jobId);
    } catch {
      // Job may have already left a cancellable state.
    }
  }

  params.updateNodeData?.(params.nodeId, (current) => {
    const cleared = clearGenerativeProgress(current.metadata);
    return {
      metadata: withAiVideoGeneratingFlag(cleared, false),
    };
  });
  showGenerativeCancelledNotice(params.nodeId);
}
