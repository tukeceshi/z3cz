import type {
  ExternalEventContinuation,
  PendingContinuation,
  UpstreamPollContinuation,
} from "@dafthunk/types";

import type { ExecutionState } from "../execution-types";

export type WakeAction = "immediate" | "sleep" | "wait_event";

export interface WakePlan {
  readonly action: WakeAction;
  readonly delayMs?: number;
  readonly eventChannel?: string;
  readonly waitTimeout?: string;
  readonly reason: string;
}

export interface HeartbeatState {
  execution: ExecutionState;
  continuations: Map<string, PendingContinuation>;
  tick: number;
  started: Set<string>;
  settled: Set<string>;
}

export function createHeartbeatState(execution: ExecutionState): HeartbeatState {
  return {
    execution,
    continuations: new Map(),
    tick: 0,
    started: new Set(),
    settled: new Set(),
  };
}

function parseTimeoutMs(timeout: string): number | undefined {
  const match = timeout
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(second|minute|hour|day)s?$/i);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
  };
  return value * (multipliers[unit] ?? 1000);
}

export function addDurationIso(now: Date, timeout: string): string {
  const ms = parseTimeoutMs(timeout);
  if (ms === undefined) {
    return new Date(now.getTime() + 30 * 60_000).toISOString();
  }
  return new Date(now.getTime() + ms).toISOString();
}

export function externalEventContinuation(
  nodeId: string,
  eventType: string,
  timeout: string,
  now: Date = new Date()
): ExternalEventContinuation {
  return {
    kind: "external_event",
    nodeId,
    eventType,
    timeout,
    createdAt: now.toISOString(),
    timeoutAt: addDurationIso(now, timeout),
  };
}

export function listContinuations(
  state: HeartbeatState
): ReadonlyArray<PendingContinuation> {
  return [...state.continuations.values()];
}

export function getContinuation(
  state: HeartbeatState,
  nodeId: string
): PendingContinuation | undefined {
  return state.continuations.get(nodeId);
}

export function registerContinuation(
  state: HeartbeatState,
  continuation: PendingContinuation
): HeartbeatState {
  const continuations = new Map(state.continuations);
  continuations.set(continuation.nodeId, continuation);
  return { ...state, continuations };
}

export function removeContinuation(
  state: HeartbeatState,
  nodeId: string
): HeartbeatState {
  const continuations = new Map(state.continuations);
  continuations.delete(nodeId);
  return { ...state, continuations };
}

export function listDuePolls(
  state: HeartbeatState,
  now: Date
): ReadonlyArray<UpstreamPollContinuation> {
  const nowMs = now.getTime();
  return listContinuations(state).filter(
    (continuation): continuation is UpstreamPollContinuation =>
      continuation.kind === "upstream_poll" &&
      Date.parse(continuation.nextPollAt) <= nowMs
  );
}

export function listExternalEventContinuations(
  state: HeartbeatState
): ReadonlyArray<ExternalEventContinuation> {
  return listContinuations(state).filter(
    (continuation): continuation is ExternalEventContinuation =>
      continuation.kind === "external_event"
  );
}

export function computeNextWake(
  state: HeartbeatState,
  now: Date,
  multiplexEventType: string
): WakePlan {
  const nowMs = now.getTime();
  let earliestPollMs: number | undefined;
  let earliestTimeoutMs: number | undefined;

  for (const continuation of state.continuations.values()) {
    if (continuation.kind === "upstream_poll") {
      const pollAt = Date.parse(continuation.nextPollAt);
      if (pollAt > nowMs) {
        earliestPollMs =
          earliestPollMs === undefined
            ? pollAt
            : Math.min(earliestPollMs, pollAt);
      }
    }

    const timeoutAt = Date.parse(continuation.timeoutAt);
    if (timeoutAt > nowMs) {
      earliestTimeoutMs =
        earliestTimeoutMs === undefined
          ? timeoutAt
          : Math.min(earliestTimeoutMs, timeoutAt);
    }
  }

  const hasDuePoll = listDuePolls(state, now).length > 0;
  if (hasDuePoll) {
    return { action: "immediate", reason: "upstream poll due" };
  }

  if (state.continuations.size === 0) {
    return { action: "immediate", reason: "no pending continuations" };
  }

  const externalEvents = listExternalEventContinuations(state);
  if (externalEvents.length > 0) {
    const maxTimeout = externalEvents.reduce((latest, continuation) => {
      const parsed = Date.parse(continuation.timeoutAt);
      return parsed > latest ? parsed : latest;
    }, nowMs);
    const waitMs = Math.max(0, maxTimeout - nowMs);
    const waitTimeout = formatWorkflowTimeout(waitMs);
    return {
      action: "wait_event",
      eventChannel: multiplexEventType,
      waitTimeout,
      reason: "waiting for external events",
    };
  }

  if (earliestPollMs !== undefined) {
    return {
      action: "sleep",
      delayMs: Math.max(0, earliestPollMs - nowMs),
      reason: "waiting for upstream poll interval",
    };
  }

  if (earliestTimeoutMs !== undefined) {
    return {
      action: "sleep",
      delayMs: Math.max(0, earliestTimeoutMs - nowMs),
      reason: "waiting for continuation timeout",
    };
  }

  return { action: "immediate", reason: "default" };
}

function formatWorkflowTimeout(delayMs: number): string {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  if (seconds >= 86_400) {
    return `${Math.ceil(seconds / 86_400)} days`;
  }
  if (seconds >= 3600) {
    return `${Math.ceil(seconds / 3600)} hours`;
  }
  if (seconds >= 60) {
    return `${Math.ceil(seconds / 60)} minutes`;
  }
  return `${seconds} seconds`;
}

export function pendingEventFromContinuation(
  continuation: PendingContinuation
): { type: string; timeout: string } | undefined {
  if (continuation.kind !== "external_event") {
    return undefined;
  }
  return { type: continuation.eventType, timeout: continuation.timeout };
}
