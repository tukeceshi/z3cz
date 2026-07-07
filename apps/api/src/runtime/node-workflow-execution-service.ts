import type { RuntimeParams } from "@dafthunk/runtime";
import type { WorkflowExecution } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, stampOnboardingStage } from "../db";
import { createNodeDurableWorkflowRuntime } from "./node-durable-workflow-runtime";
import { nodeWorkflowEventHub } from "./node-workflow-event-hub";
import { nodeFormStore } from "./node-form-store";
import { nodeWorkflowSessionHub } from "./node-workflow-session-hub";

interface NodeWorkflowInstance {
  sendEvent(event: { type: string; payload: unknown }): Promise<void>;
}

/**
 * In-process workflow execution for the Node runtime.
 * Replaces Cloudflare Workflows + WorkflowAgent for `runtime: "workflow"`.
 */
class NodeWorkflowExecutionService {
  private readonly activeExecutions = new Set<string>();
  private readonly abortControllers = new Map<string, AbortController>();

  startExecution(env: Bindings, params: RuntimeParams): string {
    const executionId = crypto.randomUUID();
    this.activeExecutions.add(executionId);
    this.abortControllers.set(executionId, new AbortController());

    void this.runExecution(env, params, executionId).finally(() => {
      this.activeExecutions.delete(executionId);
      this.abortControllers.delete(executionId);
    });

    return executionId;
  }

  cancelExecution(executionId: string): boolean {
    if (!this.activeExecutions.has(executionId)) {
      return false;
    }

    this.abortControllers.get(executionId)?.abort();
    nodeWorkflowEventHub.cancelExecutionWaits(executionId);
    this.activeExecutions.delete(executionId);
    this.abortControllers.delete(executionId);
    return true;
  }

  async getInstance(executionId: string): Promise<NodeWorkflowInstance | null> {
    if (!this.activeExecutions.has(executionId)) {
      return null;
    }

    return {
      sendEvent: async (event) => {
        const delivered = nodeWorkflowEventHub.sendEvent(executionId, event);
        if (!delivered) {
          throw new Error(
            `No waiter registered for event "${event.type}" on execution ${executionId}`
          );
        }
      },
    };
  }

  private async runExecution(
    env: Bindings,
    params: RuntimeParams,
    executionId: string
  ): Promise<void> {
    const workflowId = params.workflow.id;
    const reportProgress = async (execution: WorkflowExecution) => {
      nodeFormStore.extractFromExecution(execution, params.organizationId);
      nodeWorkflowSessionHub.broadcastExecution(workflowId, execution);
    };

    const runtime = createNodeDurableWorkflowRuntime(env, reportProgress);

    try {
      const result = await runtime.execute(params, executionId);
      nodeWorkflowSessionHub.broadcastExecution(workflowId, result);

      if (result.status === "completed" && params.userId) {
        try {
          const db = createDatabase(env);
          await stampOnboardingStage(db, params.userId, "workflowExecutedOk");
        } catch (error) {
          console.error(
            "[NodeWorkflowExecution] Failed to stamp workflow_executed_ok:",
            error
          );
        }
      }
    } catch (error) {
      console.error("[NodeWorkflowExecution] execution failed:", error);
      nodeWorkflowEventHub.cancelExecutionWaits(executionId);
      nodeWorkflowSessionHub.broadcastExecution(workflowId, {
        id: executionId,
        workflowId,
        status: "error",
        nodeExecutions: [],
        error: error instanceof Error ? error.message : "Execution failed",
      });
    }
  }
}

export const nodeWorkflowExecutionService = new NodeWorkflowExecutionService();
