import type { ExecutionEventPayload } from "@dafthunk/types";
import {
  buildExecutionEventEnvelope,
  wrapMultiplexWorkflowEvent,
} from "@dafthunk/runtime/heartbeat/execution-event-protocol";

export function buildMultiplexWorkflowSendEvent(
  executionId: string,
  eventType: string,
  payload: ExecutionEventPayload,
  nodeId?: string
): { type: string; payload: ReturnType<typeof buildExecutionEventEnvelope> } {
  return wrapMultiplexWorkflowEvent(
    executionId,
    buildExecutionEventEnvelope(eventType, payload, nodeId)
  );
}
