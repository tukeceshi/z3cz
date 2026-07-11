import type { WorkflowExecution } from "@dafthunk/types";

import { applyNodeResult, getExecutionStatus } from "../execution-state";
import type {
  ExecutionState,
  NodeExecutionResult,
  WorkflowExecutionContext,
} from "../execution-types";
import {
  computeNextWake,
  createHeartbeatState,
  listExternalEventContinuations,
  pendingEventFromContinuation,
  registerContinuation,
  removeContinuation,
  type HeartbeatState,
  type WakePlan,
} from "./continuation-store";
import {
  matchesExternalEvent,
  resolveExternalEventTimeout,
} from "./external-continuation-handler";
import type { ExecutionEventInbox } from "./execution-event-protocol";
import { getMultiplexEventType } from "./execution-event-protocol";
import type { PollContinuationHandler } from "./poll-continuation-handler";

export interface RuntimeHeartbeatHost {
  invokeNode(
    context: WorkflowExecutionContext,
    state: ExecutionState,
    nodeId: string
  ): Promise<NodeExecutionResult>;

  transformExternalEvent(
    context: WorkflowExecutionContext,
    nodeId: string,
    payload: {
      outputs: Record<string, unknown>;
      usage: number;
      error?: string;
    }
  ): Promise<NodeExecutionResult>;

  buildNodeExecutions(
    context: WorkflowExecutionContext,
    state: ExecutionState,
    continuations: Map<string, import("@dafthunk/types").PendingContinuation>
  ): WorkflowExecution["nodeExecutions"];

  getEventInbox(executionId: string): ExecutionEventInbox;
}

function buildDependencies(
  context: WorkflowExecutionContext
): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();
  for (const node of context.workflow.nodes) {
    dependencies.set(node.id, new Set());
  }
  for (const edge of context.workflow.edges) {
    dependencies.get(edge.target)?.add(edge.source);
  }
  return dependencies;
}

function isNodeReady(
  nodeId: string,
  dependencies: Map<string, Set<string>>,
  heartbeatState: HeartbeatState
): boolean {
  if (heartbeatState.started.has(nodeId)) {
    return false;
  }
  const deps = dependencies.get(nodeId);
  if (deps) {
    for (const upstream of deps) {
      if (!heartbeatState.settled.has(upstream)) {
        return false;
      }
    }
  }
  return true;
}

function listReadyNodeIds(
  context: WorkflowExecutionContext,
  dependencies: Map<string, Set<string>>,
  heartbeatState: HeartbeatState
): string[] {
  return context.orderedNodeIds.filter((nodeId) =>
    isNodeReady(nodeId, dependencies, heartbeatState)
  );
}

function applyInvokeResult(
  heartbeatState: HeartbeatState,
  result: NodeExecutionResult
): HeartbeatState {
  if (result.status === "pending") {
    let next = heartbeatState;
    if (result.continuation) {
      next = registerContinuation(next, result.continuation);
    }
    return next;
  }

  applyNodeResult(heartbeatState.execution, result);
  const settled = new Set(heartbeatState.settled);
  settled.add(result.nodeId);
  return removeContinuation({ ...heartbeatState, settled }, result.nodeId);
}

async function processInboxEvents(
  host: RuntimeHeartbeatHost,
  context: WorkflowExecutionContext,
  heartbeatState: HeartbeatState,
  inbox: ExecutionEventInbox
): Promise<HeartbeatState> {
  const envelopes = inbox.drain(context.executionId);
  let next = heartbeatState;
  const unmatched: typeof envelopes = [];

  for (const envelope of envelopes) {
    let matched = false;
    for (const continuation of listExternalEventContinuations(next)) {
      if (
        !matchesExternalEvent(
          continuation,
          envelope.eventType,
          envelope.nodeId
        )
      ) {
        continue;
      }

      matched = true;
      const resolved = envelope.payload.error
        ? ({
            nodeId: continuation.nodeId,
            status: "error" as const,
            error: envelope.payload.error,
            usage: envelope.payload.usage ?? 0,
          } satisfies NodeExecutionResult)
        : await host.transformExternalEvent(context, continuation.nodeId, {
            outputs: envelope.payload.outputs ?? {},
            usage: envelope.payload.usage ?? 0,
            error: envelope.payload.error,
          });

      next = applyInvokeResult(next, resolved);
    }

    if (!matched) {
      unmatched.push(envelope);
    }
  }

  for (const envelope of unmatched) {
    inbox.push(context.executionId, envelope);
  }

  return next;
}

function processTimedOutContinuations(
  heartbeatState: HeartbeatState,
  now: Date
): HeartbeatState {
  let next = heartbeatState;
  for (const continuation of listExternalEventContinuations(next)) {
    const timedOut = resolveExternalEventTimeout(continuation, now);
    if (timedOut) {
      next = applyInvokeResult(next, timedOut);
    }
  }
  return next;
}

export async function runHeartbeatTick(
  host: RuntimeHeartbeatHost,
  context: WorkflowExecutionContext,
  heartbeatState: HeartbeatState,
  pollHandler: PollContinuationHandler,
  now: Date = new Date()
): Promise<HeartbeatState> {
  const inbox = host.getEventInbox(context.executionId);
  const dependencies = buildDependencies(context);

  let next = heartbeatState;
  next = await processInboxEvents(host, context, next, inbox);
  next = processTimedOutContinuations(next, now);
  next = await pollHandler.pollDue(context, next, now);

  const readyIds = listReadyNodeIds(context, dependencies, next);
  if (readyIds.length === 0) {
    return { ...next, tick: next.tick + 1 };
  }

  const started = new Set(next.started);
  for (const nodeId of readyIds) {
    started.add(nodeId);
  }

  const invokeResults = await Promise.all(
    readyIds.map((nodeId) =>
      host.invokeNode(context, next.execution, nodeId)
    )
  );

  next = { ...next, started };

  for (const nodeId of context.orderedNodeIds) {
    const result = invokeResults.find((entry) => entry.nodeId === nodeId);
    if (!result) {
      continue;
    }
    next = applyInvokeResult(next, result);
  }

  // Match inbox events that arrived before the node registered its continuation.
  next = await processInboxEvents(host, context, next, inbox);

  return { ...next, tick: next.tick + 1 };
}

export function isHeartbeatTerminal(
  context: WorkflowExecutionContext,
  heartbeatState: HeartbeatState
): boolean {
  if (heartbeatState.continuations.size > 0) {
    return false;
  }
  return getExecutionStatus(context, heartbeatState.execution) !== "executing";
}

export function computeHeartbeatWake(
  context: WorkflowExecutionContext,
  heartbeatState: HeartbeatState,
  now: Date = new Date()
): WakePlan {
  const dependencies = buildDependencies(context);
  const hasReady =
    listReadyNodeIds(context, dependencies, heartbeatState).length > 0;
  if (hasReady) {
    return { action: "immediate", reason: "ready nodes" };
  }

  return computeNextWake(
    heartbeatState,
    now,
    getMultiplexEventType(context.executionId)
  );
}

export async function runWorkflowHeartbeat(
  host: RuntimeHeartbeatHost,
  context: WorkflowExecutionContext,
  state: ExecutionState,
  executionRecord: WorkflowExecution,
  pollHandler: PollContinuationHandler,
  callbacks: {
    executeStep<T>(name: string, fn: () => Promise<T>): Promise<T>;
    executeSleep(name: string, durationMs: number): Promise<void>;
    waitForNodeEvent<T>(
      name: string,
      eventType: string,
      timeout: string
    ): Promise<T>;
    sendProgress(record: WorkflowExecution): Promise<void>;
  }
): Promise<{ state: ExecutionState; record: WorkflowExecution }> {
  let heartbeatState = createHeartbeatState(state);
  let currentRecord = executionRecord;

  const sendProgress = async (): Promise<void> => {
    currentRecord = {
      ...currentRecord,
      status: getExecutionStatus(context, heartbeatState.execution),
      heartbeatTick: heartbeatState.tick,
      nodeExecutions: host.buildNodeExecutions(
        context,
        heartbeatState.execution,
        heartbeatState.continuations
      ),
    };
    await callbacks.sendProgress(currentRecord);
  };

  await sendProgress();

  while (!isHeartbeatTerminal(context, heartbeatState)) {
    heartbeatState = await callbacks.executeStep(
      `heartbeat tick ${heartbeatState.tick}`,
      () => runHeartbeatTick(host, context, heartbeatState, pollHandler)
    );

    await sendProgress();

    if (isHeartbeatTerminal(context, heartbeatState)) {
      break;
    }

    const wake = computeHeartbeatWake(context, heartbeatState);
    if (wake.action === "wait_event" && wake.eventChannel && wake.waitTimeout) {
      const envelope = await callbacks.waitForNodeEvent<{
        eventType: string;
        nodeId?: string;
        payload: {
          outputs?: Record<string, unknown>;
          usage?: number;
          error?: string;
        };
      }>("heartbeat", wake.eventChannel, wake.waitTimeout);

      host.getEventInbox(context.executionId).push(context.executionId, {
        eventType: envelope.eventType,
        nodeId: envelope.nodeId,
        payload: envelope.payload,
      });
      continue;
    }

    if (wake.action === "sleep" && wake.delayMs !== undefined && wake.delayMs > 0) {
      await callbacks.executeSleep("heartbeat sleep", wake.delayMs);
    }
  }

  return { state: heartbeatState.execution, record: currentRecord };
}

export function pendingNodeExecutionsFromContinuations(
  continuations: Map<string, import("@dafthunk/types").PendingContinuation>
): Map<string, { type: string; timeout: string }> {
  const pendingNodes = new Map<string, { type: string; timeout: string }>();
  for (const continuation of continuations.values()) {
    const pendingEvent = pendingEventFromContinuation(continuation);
    if (pendingEvent) {
      pendingNodes.set(continuation.nodeId, pendingEvent);
    }
  }
  return pendingNodes;
}
