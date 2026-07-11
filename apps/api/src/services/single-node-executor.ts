import type { RuntimeParams } from "@dafthunk/runtime";
import type { WorkflowExecution, WorkflowExecutionStatus } from "@dafthunk/types";

import type { Bindings } from "../context";
import { CloudflareExecutionStore } from "../runtime/cloudflare-execution-store";

const TERMINAL_STATUSES = new Set<WorkflowExecutionStatus>([
  "completed",
  "error",
  "cancelled",
  "exhausted",
]);

const DEFAULT_POLL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toWorkflowExecution(
  record: NonNullable<Awaited<ReturnType<CloudflareExecutionStore["getWithData"]>>>
): WorkflowExecution {
  return {
    id: record.id,
    workflowId: record.workflowId,
    workflowName: record.workflowName,
    status: record.status as WorkflowExecutionStatus,
    nodeExecutions: record.data.nodeExecutions ?? [],
    error: record.error ?? undefined,
    startedAt: record.startedAt ?? record.data.startedAt,
    endedAt: record.endedAt ?? record.data.endedAt,
  };
}

/**
 * Wait until a durable workflow execution reaches a terminal status.
 * Used by single-node execute so Replicate polling runs via pending continuations
 * instead of blocking inside WorkerRuntime.
 */
export async function waitForTerminalExecution(
  env: Bindings,
  executionId: string,
  organizationId: string,
  options?: { timeoutMs?: number; pollMs?: number }
): Promise<WorkflowExecution> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const store = new CloudflareExecutionStore(env);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const record = await store.getWithData(executionId, organizationId);
    if (record) {
      const status = record.status as WorkflowExecutionStatus;
      if (TERMINAL_STATUSES.has(status)) {
        return toWorkflowExecution(record);
      }
    }
    await sleep(pollMs);
  }

  throw new Error("Single-node execution timed out before completion");
}

/**
 * Execute a single-node workflow via the durable runtime so async upstream polling
 * (e.g. Replicate) is supported. On Node dev, runs in-process and awaits completion.
 * On Cloudflare, starts durable execution and polls the execution store.
 */
export async function executeSingleNodeWorkflow(
  env: Bindings,
  params: RuntimeParams
): Promise<WorkflowExecution> {
  const durableParams: RuntimeParams = {
    ...params,
    workflow: {
      ...params.workflow,
      runtime: "workflow",
    },
  };

  if (env.RUNTIME === "node") {
    const { createNodeDurableWorkflowRuntime } = await import(
      "../runtime/node-durable-workflow-runtime"
    );
    const executionId = crypto.randomUUID();
    const runtime = createNodeDurableWorkflowRuntime(env);
    return runtime.execute(durableParams, executionId);
  }

  const { startWorkflowExecution } = await import(
    "../runtime/start-workflow-execution"
  );
  const { executionId } = await startWorkflowExecution(env, durableParams);

  return waitForTerminalExecution(env, executionId, params.organizationId);
}
