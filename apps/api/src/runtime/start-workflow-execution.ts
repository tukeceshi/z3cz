import type { RuntimeParams } from "@dafthunk/runtime";
import type { WorkflowExecutionStatus } from "@dafthunk/types";

import type { Bindings } from "../context";

export interface StartWorkflowExecutionResult {
  readonly executionId: string;
  readonly status?: WorkflowExecutionStatus;
  readonly error?: string;
}

/**
 * Start a workflow execution using the appropriate runtime backend.
 * Worker = synchronous; workflow = durable (Cloudflare Workflows or Node in-process).
 */
export async function startWorkflowExecution(
  env: Bindings,
  params: RuntimeParams
): Promise<StartWorkflowExecutionResult> {
  if (params.workflow.runtime === "worker") {
    const { createWorkerRuntime } = await import(
      "./cloudflare-worker-runtime"
    );
    const execution = await (await createWorkerRuntime(env)).execute(params);
    return {
      executionId: execution.id,
      status: execution.status,
      error: execution.error,
    };
  }

  if (env.RUNTIME === "node") {
    const { nodeWorkflowExecutionService } = await import(
      "./node-workflow-execution-service"
    );
    const executionId = nodeWorkflowExecutionService.startExecution(
      env,
      params
    );
    return { executionId };
  }

  const { getAgentByName } = await import("../durable-objects/agent-utils");
  const agent = await getAgentByName(env.WORKFLOW_AGENT, params.workflow.id);
  const executionId = await agent.executeWorkflow(params);
  return { executionId };
}
