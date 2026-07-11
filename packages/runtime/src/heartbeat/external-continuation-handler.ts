import type { ExternalEventContinuation } from "@dafthunk/types";

import type { NodeExecutionResult } from "../execution-types";

export interface ExternalEventResolutionContext {
  resolveTimeout(
    continuation: ExternalEventContinuation,
    now: Date
  ): NodeExecutionResult | null;
}

export function resolveExternalEventTimeout(
  continuation: ExternalEventContinuation,
  now: Date
): NodeExecutionResult | null {
  if (Date.parse(continuation.timeoutAt) > now.getTime()) {
    return null;
  }

  return {
    nodeId: continuation.nodeId,
    status: "error",
    error: `Timed out waiting for event "${continuation.eventType}" after ${continuation.timeout}`,
  };
}

export function matchesExternalEvent(
  continuation: ExternalEventContinuation,
  eventType: string,
  nodeId?: string
): boolean {
  if (continuation.eventType !== eventType) {
    return false;
  }
  if (nodeId !== undefined && continuation.nodeId !== nodeId) {
    return false;
  }
  return true;
}
