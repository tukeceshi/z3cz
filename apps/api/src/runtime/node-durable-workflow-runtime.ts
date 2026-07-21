import {
  type MonitoringService,
  Runtime,
  type RuntimeParams,
} from "@dafthunk/runtime";
import type { WorkflowExecution } from "@dafthunk/types";

import type { Bindings } from "../context";
import { buildDependencies } from "./cloudflare-runtime-dependencies";
import type { ExecutionEventInbox } from "@dafthunk/runtime/heartbeat/execution-event-protocol";
import { nodeWorkflowEventHub } from "./node-workflow-event-hub";

/**
 * Node.js implementation of durable workflow execution.
 * Supports async nodes (wait-for-form) via the in-memory event hub.
 * Step durability is in-process only — sufficient for local development.
 */
class NodeDurableWorkflowRuntime extends Runtime<Bindings> {
  protected override readonly supportsAsync = true;
  private executionId = "";

  async execute(
    params: RuntimeParams,
    instanceId: string
  ): Promise<WorkflowExecution> {
    this.executionId = instanceId;
    try {
      return await this.run(params, instanceId);
    } finally {
      this.executionId = "";
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

  protected async executeSleep(
    _name: string,
    durationMs: number
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  protected waitForNodeEvent<T>(
    _name: string,
    eventType: string,
    timeout: string
  ): Promise<T> {
    return nodeWorkflowEventHub.waitForEvent<T>(
      this.executionId,
      eventType,
      timeout
    );
  }

  protected override getExecutionEventInbox(_executionId: string): ExecutionEventInbox {
    return {
      drain: (executionId) => nodeWorkflowEventHub.drainInbox(executionId),
      push: (executionId, envelope) =>
        nodeWorkflowEventHub.pushInbox(executionId, envelope),
    };
  }
}

export async function createNodeDurableWorkflowRuntime(
  env: Bindings,
  reportProgress: (execution: WorkflowExecution) => Promise<void>
): Promise<NodeDurableWorkflowRuntime> {
  const monitoringService: MonitoringService = {
    async sendUpdate(execution) {
      await reportProgress(execution);
    },
  };
  return new NodeDurableWorkflowRuntime(
    env,
    await buildDependencies(env, monitoringService)
  );
}

export { NodeDurableWorkflowRuntime };
