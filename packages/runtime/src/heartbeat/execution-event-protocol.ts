import type {
  ExecutionEventEnvelope,
  ExecutionEventPayload,
} from "@dafthunk/types";

export function getMultiplexEventType(executionId: string): string {
  return `execution:${executionId}`;
}

export function buildExecutionEventEnvelope(
  eventType: string,
  payload: ExecutionEventPayload,
  nodeId?: string
): ExecutionEventEnvelope {
  return {
    eventType,
    nodeId,
    payload,
  };
}

export function wrapMultiplexWorkflowEvent(
  executionId: string,
  envelope: ExecutionEventEnvelope
): { type: string; payload: ExecutionEventEnvelope } {
  return {
    type: getMultiplexEventType(executionId),
    payload: envelope,
  };
}

export interface ExecutionEventInbox {
  drain(executionId: string): ExecutionEventEnvelope[];
  push(executionId: string, envelope: ExecutionEventEnvelope): void;
}

export function createMemoryExecutionEventInbox(
  store: Map<string, ExecutionEventEnvelope[]>
): ExecutionEventInbox {
  return {
    drain(executionId: string): ExecutionEventEnvelope[] {
      const queued = store.get(executionId);
      if (!queued || queued.length === 0) {
        return [];
      }
      store.delete(executionId);
      return queued;
    },
    push(executionId: string, envelope: ExecutionEventEnvelope): void {
      const queued = store.get(executionId) ?? [];
      queued.push(envelope);
      store.set(executionId, queued);
    },
  };
}

/** Normalize legacy direct events or multiplex payloads into an envelope. */
export function normalizeWorkflowEvent(
  event: { type: string; payload: unknown },
  executionId: string
): ExecutionEventEnvelope {
  const multiplexType = getMultiplexEventType(executionId);
  if (event.type === multiplexType) {
    const envelope = event.payload as ExecutionEventEnvelope;
    return {
      eventType: envelope.eventType,
      nodeId: envelope.nodeId,
      payload: envelope.payload,
    };
  }

  const legacyPayload = event.payload as ExecutionEventPayload;
  return buildExecutionEventEnvelope(event.type, legacyPayload);
}
