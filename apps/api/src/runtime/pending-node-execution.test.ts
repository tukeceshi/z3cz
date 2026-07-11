/**
 * Pending (async) node execution scenarios.
 *
 * A node can return `status: "pending"` with a `pendingEvent`, parking the
 * workflow until an external event arrives (`waitForNodeEvent`). This is a
 * generic mechanism — `wait-for-form` (human-in-the-loop) and async agent
 * nodes both use it. These tests use `wait-for-form` as the concrete example
 * but characterise the runtime's pending-node behaviour, especially when
 * *several* pending nodes are in flight at once.
 *
 * Rather than going through real Cloudflare Workflows event delivery (which is
 * timing-dependent and hard to drive deterministically), we run the real
 * `Runtime` execution loop against a controllable runtime whose
 * `waitForNodeEvent` is backed by an in-memory bus. The test decides exactly
 * when each parked node receives its event, which lets us assert:
 *
 *  1. Same-level parallel pending nodes park together and the workflow waits
 *     for *all* of them before dependent nodes run (no error when one resolves).
 *  2. Pending nodes on independent branches park and resolve concurrently and
 *     in any order — a deeper one opens as soon as its own upstream settles,
 *     never gated by an unrelated branch. (The runtime uses dependency-driven
 *     scheduling, not topological-level barriers.)
 *  3. Early events are buffered in the inbox and applied once the node registers
 *     its continuation on the same heartbeat tick.
 */
import { env } from "cloudflare:test";
import {
  BaseNodeRegistry,
  Runtime,
  type RuntimeDependencies,
  type RuntimeParams,
} from "@dafthunk/runtime";
import {
  buildExecutionEventEnvelope,
  type ExecutionEventInbox,
} from "@dafthunk/runtime/heartbeat/execution-event-protocol";
import { TextInputNode } from "@dafthunk/runtime/nodes/input/text-input-node";
import { WaitForFormNode } from "@dafthunk/runtime/nodes/logic/wait-for-form-node";
import { StringToUpperCaseNode } from "@dafthunk/runtime/nodes/text/string-to-upper-case-node";
import type { ExecutionEventEnvelope, Workflow, WorkflowExecution } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import type { Bindings } from "../context";
import { MockCredentialService } from "../mocks/credential-service";
import { MockDatabaseService } from "../mocks/database-service";
import { MockDatasetService } from "../mocks/dataset-service";
import { MockExecutionStore } from "../mocks/execution-store";
import { MockMonitoringService } from "../mocks/monitoring-service";
import { MockQueueService } from "../mocks/queue-service";
import {
  buildPresignedUrlConfig,
  CloudflareObjectStore,
} from "./cloudflare-object-store";

// ---------------------------------------------------------------------------
// Test runtime
// ---------------------------------------------------------------------------

/** Minimal registry: a string source, a string transform (to add depth), and the HITL node. */
class HitlNodeRegistry extends BaseNodeRegistry<Bindings> {
  protected registerNodes(): void {
    this.registerImplementation(TextInputNode);
    this.registerImplementation(StringToUpperCaseNode);
    this.registerImplementation(WaitForFormNode);
  }
}

/**
 * Runtime that supports async nodes via the workflow heartbeat loop.
 * Multiplex event waits and an inbox simulate production event delivery.
 */
class ControllableHitlRuntime extends Runtime<Bindings> {
  protected override readonly supportsAsync = true;

  private executionId = "";
  private multiplexResolve:
    | ((envelope: ExecutionEventEnvelope) => void)
    | null = null;
  private readonly inbox: ExecutionEventEnvelope[] = [];
  readonly registrationLog: string[] = [];
  readonly pendingNodeIds: string[] = [];

  async run(
    params: RuntimeParams,
    instanceId: string
  ): Promise<WorkflowExecution> {
    this.executionId = instanceId;
    this.pendingNodeIds.length = 0;
    this.registrationLog.length = 0;
    try {
      return await super.run(params, instanceId);
    } finally {
      this.executionId = "";
      this.multiplexResolve = null;
    }
  }

  protected async executeStep<T>(
    _name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return fn();
  }

  protected async executeSubStep<T>(
    _name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return fn();
  }

  protected async executeSleep(): Promise<void> {
    // no-op: nothing in these tests sleeps
  }

  protected waitForNodeEvent<T>(
    _name: string,
    eventType: string,
    _timeout: string
  ): Promise<T> {
    this.registrationLog.push(eventType);
    return new Promise<T>((resolve) => {
      this.multiplexResolve = resolve as (
        envelope: ExecutionEventEnvelope
      ) => void;
    });
  }

  protected override getExecutionEventInbox(
    _executionId: string
  ): ExecutionEventInbox {
    return {
      drain: () => {
        const queued = [...this.inbox];
        this.inbox.length = 0;
        return queued;
      },
      push: (_executionId, envelope) => {
        this.inbox.push(envelope);
      },
    };
  }

  trackPending(execution: WorkflowExecution): void {
    this.pendingNodeIds.length = 0;
    for (const nodeExecution of execution.nodeExecutions) {
      if (nodeExecution.status === "pending") {
        this.pendingNodeIds.push(nodeExecution.nodeId);
      }
    }
    this.pendingNodeIds.sort();
  }

  /**
   * Simulate a form submission. Events are buffered in the inbox when the
   * heartbeat is not yet waiting, then consumed on the next tick.
   */
  deliver(
    nodeId: string,
    response: Record<string, unknown>,
    eventType: string
  ): boolean {
    const envelope = buildExecutionEventEnvelope(
      eventType,
      { outputs: { response }, usage: 0 },
      nodeId
    );

    if (this.multiplexResolve) {
      this.multiplexResolve(envelope);
      this.multiplexResolve = null;
      return true;
    }

    this.inbox.push(envelope);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRuntime(): ControllableHitlRuntime {
  const e = env as unknown as Bindings;
  const nodeRegistry = new HitlNodeRegistry(e, true);
  const objectStore = new CloudflareObjectStore(
    e.RESSOURCES,
    buildPresignedUrlConfig(e)
  );
  const credentialProvider = new MockCredentialService();
  const mockMonitoring = new MockMonitoringService();
  let runtime: ControllableHitlRuntime;

  const dependencies: RuntimeDependencies<Bindings> = {
    nodeRegistry,
    credentialProvider,
    executionStore: new MockExecutionStore(),
    monitoringService: {
      async sendUpdate(execution) {
        runtime.trackPending(execution);
        await mockMonitoring.sendUpdate(execution);
      },
    },
    creditService: {
      hasEnoughCredits: async () => true,
      recordUsage: async () => {},
      settleAvailability: async () => {},
    },
    objectStore,
    databaseService: new MockDatabaseService(),
    datasetService: new MockDatasetService(),
    queueService: new MockQueueService(),
  };

  runtime = new ControllableHitlRuntime(e, dependencies);
  return runtime;
}

let instanceCounter = 0;
function nextInstanceId(): string {
  instanceCounter += 1;
  return `hitl-test-${instanceCounter}`;
}

function params(workflow: Workflow): RuntimeParams {
  return {
    workflow,
    userId: "test-user",
    organizationId: "test-org",
    computeCredits: 10000,
  };
}

/** Flush pending micro/macro tasks so the runtime reaches its next park point. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function textInput(id: string, value: string): Workflow["nodes"][number] {
  return {
    id,
    name: id,
    type: "text-input",
    position: { x: 0, y: 0 },
    inputs: [{ name: "value", type: "string", value, hidden: true }],
    outputs: [{ name: "value", type: "string" }],
  };
}

function upper(id: string): Workflow["nodes"][number] {
  return {
    id,
    name: id,
    type: "string-to-upper-case",
    position: { x: 0, y: 0 },
    inputs: [{ name: "string", type: "string", required: true }],
    outputs: [{ name: "result", type: "string" }],
  };
}

function waitForForm(id: string): Workflow["nodes"][number] {
  return {
    id,
    name: id,
    type: "wait-for-form",
    position: { x: 0, y: 0 },
    inputs: [{ name: "token", type: "string", required: true }],
    outputs: [{ name: "response", type: "json" }],
  };
}

function nodeExec(execution: WorkflowExecution, nodeId: string) {
  return execution.nodeExecutions.find((e) => e.nodeId === nodeId);
}

// ---------------------------------------------------------------------------
// Scenario 1 — same-level parallel forms
// ---------------------------------------------------------------------------

describe("Pending nodes: parallel forms on the same level", () => {
  // tA ─► wfA
  // tB ─► wfB    (wfA and wfB are both on level 1)
  const workflow: Workflow = {
    id: "hitl-same-level",
    name: "HITL Same Level",
    trigger: "manual",
    nodes: [
      textInput("tA", "tok-a"),
      textInput("tB", "tok-b"),
      waitForForm("wfA"),
      waitForForm("wfB"),
    ],
    edges: [
      {
        source: "tA",
        sourceOutput: "value",
        target: "wfA",
        targetInput: "token",
      },
      {
        source: "tB",
        sourceOutput: "value",
        target: "wfB",
        targetInput: "token",
      },
    ],
  };

  it("parks both forms concurrently and resolving one does not error the other", async () => {
    const runtime = createRuntime();
    const run = runtime.run(params(workflow), nextInstanceId());

    let settled = false;
    run.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await settle();

    // Both forms are parked at the same time.
    expect(runtime.pendingNodeIds).toEqual(["wfA", "wfB"]);
    expect(settled).toBe(false);

    // Activating one form resolves only that node; the other keeps waiting.
    expect(runtime.deliver("wfA", { approved: true }, "form-response-tok-a")).toBe(
      true
    );
    await settle();
    expect(runtime.pendingNodeIds).toEqual(["wfB"]);

    // The level barrier keeps the workflow parked until every form is answered.
    expect(settled).toBe(false);

    // Answer the second form → workflow completes.
    expect(
      runtime.deliver("wfB", { approved: false }, "form-response-tok-b")
    ).toBe(true);
    const execution = await run;

    expect(execution.status).toBe("completed");
    expect(nodeExec(execution, "wfA")?.status).toBe("completed");
    expect(nodeExec(execution, "wfB")?.status).toBe("completed");
    expect(nodeExec(execution, "wfA")?.outputs?.response).toEqual({
      approved: true,
    });
    expect(nodeExec(execution, "wfB")?.outputs?.response).toEqual({
      approved: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — independent branches on different levels
// ---------------------------------------------------------------------------

describe("Pending nodes: parallel forms on different levels", () => {
  // Branch 1 (shallow):  tA ──────────► wfA           (wfA one hop deep)
  // Branch 2 (deep):     tB ─► up ────► wfB            (wfB two hops deep)
  // The branches share no edges; answering wfA is logically unrelated to wfB.
  function makeWorkflow(): Workflow {
    return {
      id: "pending-cross-level",
      name: "Pending Cross Level",
      trigger: "manual",
      nodes: [
        textInput("tA", "tok-a"),
        textInput("tB", "tok-b"),
        upper("up"),
        waitForForm("wfA"),
        waitForForm("wfB"),
      ],
      edges: [
        {
          source: "tA",
          sourceOutput: "value",
          target: "wfA",
          targetInput: "token",
        },
        {
          source: "tB",
          sourceOutput: "value",
          target: "up",
          targetInput: "string",
        },
        {
          source: "up",
          sourceOutput: "result",
          target: "wfB",
          targetInput: "token",
        },
      ],
    };
  }

  it("parks both forms concurrently — the deeper one does not wait on the unrelated shallow one", async () => {
    const runtime = createRuntime();
    const run = runtime.run(params(makeWorkflow()), nextInstanceId());
    run.catch(() => {});

    await settle();

    // wfB opens as soon as its own upstream (`up`) finishes, regardless of
    // whether wfA (a different branch) has been answered. Both are parked.
    expect(runtime.pendingNodeIds).toEqual(["wfA", "wfB"]);
  });

  it("resolves independently and in any order, with no cross-branch coupling", async () => {
    const runtime = createRuntime();
    const run = runtime.run(params(makeWorkflow()), nextInstanceId());
    run.catch(() => {});

    await settle();
    expect(runtime.pendingNodeIds).toEqual(["wfA", "wfB"]);

    let settled = false;
    run.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    // Answer the deeper form first; the shallow one keeps waiting independently.
    expect(runtime.deliver("wfB", { ok: "b" }, "form-response-TOK-B")).toBe(
      true
    );
    await settle();
    expect(runtime.pendingNodeIds).toEqual(["wfA"]);
    expect(settled).toBe(false);

    // Answer the remaining form → workflow completes.
    expect(runtime.deliver("wfA", { ok: "a" }, "form-response-tok-a")).toBe(true);
    const execution = await run;
    expect(execution.status).toBe("completed");
    expect(nodeExec(execution, "wfA")?.outputs?.response).toEqual({ ok: "a" });
    expect(nodeExec(execution, "wfB")?.outputs?.response).toEqual({ ok: "b" });
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — events are delivered only to already-parked nodes
// ---------------------------------------------------------------------------

describe("Pending nodes: buffered events before the node parks", () => {
  // A single deep branch: tB ─► up ─► wfB. wfB parks only after `up` settles.
  function makeWorkflow(): Workflow {
    return {
      id: "pending-park-timing",
      name: "Pending Park Timing",
      trigger: "manual",
      nodes: [textInput("tB", "tok-b"), upper("up"), waitForForm("wfB")],
      edges: [
        {
          source: "tB",
          sourceOutput: "value",
          target: "up",
          targetInput: "string",
        },
        {
          source: "up",
          sourceOutput: "result",
          target: "wfB",
          targetInput: "token",
        },
      ],
    };
  }

  it("buffers an early event and applies it once the node registers a continuation", async () => {
    const runtime = createRuntime();
    const run = runtime.run(params(makeWorkflow()), nextInstanceId());

    expect(
      runtime.deliver("wfB", { ok: "early" }, "form-response-TOK-B")
    ).toBe(true);

    const execution = await run;
    expect(execution.status).toBe("completed");
    expect(nodeExec(execution, "wfB")?.outputs?.response).toEqual({
      ok: "early",
    });
  });
});
