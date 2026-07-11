import type { WorkflowRuntimeState } from "./workflow";

/** Continuation kind — heartbeat selects the handler. */
export type PendingContinuationKind = "external_event" | "upstream_poll";

export interface PendingContinuationBase {
  readonly kind: PendingContinuationKind;
  readonly nodeId: string;
  readonly createdAt: string;
  readonly timeoutAt: string;
}

/** Human-in-the-loop, agent callback, webhook wait. */
export interface ExternalEventContinuation extends PendingContinuationBase {
  readonly kind: "external_event";
  readonly eventType: string;
  readonly timeout: string;
}

/** Upstream async job poll (Seedance, Replicate, etc.) — Phase B. */
export interface UpstreamPollContinuation extends PendingContinuationBase {
  readonly kind: "upstream_poll";
  readonly provider: string;
  readonly taskId: string;
  readonly pollUrl: string;
  readonly pollIntervalMs: number;
  readonly nextPollAt: string;
  readonly profileId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export type PendingContinuation =
  | ExternalEventContinuation
  | UpstreamPollContinuation;

/** Serializable execution state snapshot for heartbeat checkpoints. */
export interface ExecutionStateSnapshot {
  readonly nodeInputs: WorkflowRuntimeState;
  readonly nodeOutputs: WorkflowRuntimeState;
  readonly executedNodes: readonly string[];
  readonly skippedNodes: readonly string[];
  readonly nodeErrors: Readonly<Record<string, string>>;
  readonly nodeUsage: Readonly<Record<string, number>>;
}

/** Payload delivered through the multiplex execution event channel. */
export interface ExecutionEventPayload {
  readonly outputs?: Readonly<Record<string, unknown>>;
  readonly usage?: number;
  readonly error?: string;
}

/** Envelope on the multiplex `execution:{executionId}` channel. */
export interface ExecutionEventEnvelope {
  readonly eventType: string;
  readonly nodeId?: string;
  readonly payload: ExecutionEventPayload;
}
