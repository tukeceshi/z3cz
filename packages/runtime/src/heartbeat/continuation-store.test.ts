import { describe, expect, it } from "vitest";

import {
  addDurationIso,
  computeNextWake,
  createHeartbeatState,
  externalEventContinuation,
  registerContinuation,
} from "./continuation-store";
import { getMultiplexEventType } from "./execution-event-protocol";

describe("continuation-store", () => {
  it("registers external event continuations", () => {
    const state = createHeartbeatState({
      nodeInputs: {},
      nodeOutputs: {},
      executedNodes: [],
      skippedNodes: [],
      nodeErrors: {},
      nodeUsage: {},
    });

    const continuation = externalEventContinuation(
      "wfA",
      "form-response-tok",
      "24 hours"
    );
    const next = registerContinuation(state, continuation);

    expect(next.continuations.get("wfA")).toEqual(continuation);
  });

  it("computes wait_event wake for external continuations", () => {
    const state = createHeartbeatState({
      nodeInputs: {},
      nodeOutputs: {},
      executedNodes: [],
      skippedNodes: [],
      nodeErrors: {},
      nodeUsage: {},
    });

    const next = registerContinuation(
      state,
      externalEventContinuation("wfA", "form-response-tok", "24 hours")
    );

    const wake = computeNextWake(
      next,
      new Date(),
      getMultiplexEventType("exec-1")
    );

    expect(wake.action).toBe("wait_event");
    expect(wake.eventChannel).toBe("execution:exec-1");
    expect(wake.waitTimeout).toBeDefined();
  });

  it("adds duration from timeout strings", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(addDurationIso(now, "30 minutes")).toBe(
      "2026-01-01T00:30:00.000Z"
    );
  });
});
