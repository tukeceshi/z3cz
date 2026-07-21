/**
 * WorkflowExecutor Service
 *
 * Centralized service for executing workflows across different trigger sources.
 * Handles parameter processing, execution creation, and persistence.
 */

import type { BlobParameter, RuntimeParams } from "@dafthunk/runtime";
import type { Node, WorkflowExecution, WorkflowRuntime, WorkflowBillingMode } from "@dafthunk/types";
import type { Bindings } from "../context";
import { createDatabase, stampOnboardingStage } from "../db";
import { createSimulatedEmailMessage } from "../utils/email";
import { createSimulatedHttpRequest } from "../utils/http";

export interface WorkflowExecutorOptions {
  workflow: {
    id: string;
    name: string;
    billingMode?: WorkflowBillingMode;
    trigger: string;
    runtime?: WorkflowRuntime;
    nodes: Node[];
    edges: any[];
  };
  userId: string;
  organizationId: string;
  computeCredits: number;
  subscriptionStatus?: string;
  /** Maximum additional usage allowed beyond included credits. null = unlimited */
  overageLimit?: number | null;
  /** When true, all credit checks are bypassed (e.g., internal/test accounts). */
  unlimitedUsage?: boolean;
  parameters?: WorkflowExecutorParameters;
  userPlan?: string;
  env: Bindings;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: string; // base64 encoded
}

export interface WorkflowExecutorParameters {
  // For email workflows
  from?: string;
  subject?: string;
  emailBody?: string;
  attachments?: EmailAttachment[];
  // For HTTP workflows
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: BlobParameter;
  // For form workflows: the validated submission record
  formRecord?: Record<string, unknown>;
}

export interface WorkflowExecutorResult {
  executionId: string;
  execution: WorkflowExecution;
}

export class WorkflowExecutor {
  static buildRuntimeParams(options: WorkflowExecutorOptions): RuntimeParams {
    const {
      workflow,
      userId,
      organizationId,
      computeCredits,
      subscriptionStatus,
      overageLimit,
      unlimitedUsage,
      parameters,
      userPlan,
      env,
    } = options;

    const baseExecutionParams = {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        billingMode: workflow.billingMode,
        trigger: workflow.trigger,
        runtime: workflow.runtime,
        nodes: workflow.nodes,
        edges: workflow.edges,
      },
      userId,
      organizationId,
      computeCredits,
      ...(subscriptionStatus && { subscriptionStatus }),
      ...(overageLimit !== undefined && { overageLimit }),
      ...(unlimitedUsage !== undefined && { unlimitedUsage }),
      ...(userPlan && { userPlan }),
    };

    if (workflow.trigger === "email_message") {
      return {
        ...baseExecutionParams,
        emailMessage: createSimulatedEmailMessage({
          from: parameters?.from,
          subject: parameters?.subject,
          body: parameters?.emailBody,
          attachments: parameters?.attachments,
          workflowId: workflow.id,
          emailDomain: env.EMAIL_DOMAIN,
        }),
      };
    }

    if (
      workflow.trigger === "http_webhook" ||
      workflow.trigger === "http_request"
    ) {
      return {
        ...baseExecutionParams,
        httpRequest: createSimulatedHttpRequest({
          url: parameters?.url,
          method: parameters?.method,
          headers: parameters?.headers,
          query: parameters?.query,
          body: parameters?.body,
        }),
      };
    }

    if (
      workflow.trigger === "form_request" ||
      workflow.trigger === "form_webhook"
    ) {
      return {
        ...baseExecutionParams,
        formSubmission: {
          record: parameters?.formRecord ?? {},
          timestamp: Date.now(),
        },
      };
    }

    return {
      ...baseExecutionParams,
      httpRequest: createSimulatedHttpRequest({
        url: parameters?.url,
        method: parameters?.method,
        headers: parameters?.headers,
        query: parameters?.query,
      }),
    };
  }

  /**
   * Execute a workflow with the given options
   */
  static async execute(
    options: WorkflowExecutorOptions
  ): Promise<WorkflowExecutorResult> {
    const { workflow, userId, env } = options;

    // Best-effort onboarding stamp: capture "this user attempted an execution"
    // regardless of whether it ultimately succeeds. The ok-stamp happens after
    // execution finalizes (worker path below, or in WorkflowRuntimeEntrypoint).
    try {
      const db = createDatabase(env);
      await stampOnboardingStage(db, userId, "workflowExecuted");
    } catch (error) {
      console.error("Failed to stamp workflow_executed onboarding:", error);
    }

    const finalExecutionParams = WorkflowExecutor.buildRuntimeParams(options);

    const { validateWorkflowGraphAgainstCatalog } = await import(
      "../utils/workflow-catalog-validation"
    );
    await validateWorkflowGraphAgainstCatalog(env, {
      nodes: workflow.nodes,
    });

    // Use WorkerRuntime for "worker" runtime (synchronous execution)
    // Use Cloudflare Workflows for "workflow" runtime (durable execution, default)
    if (workflow.runtime === "worker") {
      const { createWorkerRuntime } = await import(
        "../runtime/cloudflare-worker-runtime"
      );
      const workerRuntime = await createWorkerRuntime(env);
      const execution = await workerRuntime.execute(finalExecutionParams);
      console.log(
        `[Execution] ${execution.id} workflow=${workflow.id} runtime=worker trigger=${workflow.trigger}`
      );

      // Worker runtime is synchronous �?stamp ok here. Durable runtime stamps
      // in WorkflowRuntimeEntrypoint.run() once the workflow completes.
      if (execution.status === "completed") {
        try {
          const db = createDatabase(env);
          await stampOnboardingStage(db, userId, "workflowExecutedOk");
        } catch (error) {
          console.error(
            "Failed to stamp workflow_executed_ok onboarding:",
            error
          );
        }
      }

      return { executionId: execution.id, execution };
    }

    // Start workflow execution via Agent RPC (durable) or Node in-process runner
    const { startWorkflowExecution } = await import(
      "../runtime/start-workflow-execution"
    );
    const result = await startWorkflowExecution(env, finalExecutionParams);
    const executionId = result.executionId;
    console.log(
      `[Execution] ${executionId} workflow=${workflow.id} runtime=workflow trigger=${workflow.trigger}`
    );

    const nodeExecutions = workflow.nodes.map((node) => ({
      nodeId: node.id,
      status: "executing" as const,
      usage: 0,
    }));

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: "submitted",
      nodeExecutions,
    };

    return { executionId, execution };
  }
}
