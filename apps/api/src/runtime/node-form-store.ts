import type { WorkflowExecution } from "@dafthunk/types";

import { nodeWorkflowEventHub } from "./node-workflow-event-hub";
import { buildMultiplexWorkflowSendEvent } from "./workflow-event-utils";

interface FormSubmissionRecord {
  readonly submitted: boolean;
  readonly submittedAt?: number;
}

/**
 * In-memory form state for the Node runtime.
 * Mirrors WorkflowAgent DO storage for HITL forms and feedback pages.
 */
class NodeFormStore {
  private readonly forms = new Map<string, FormSubmissionRecord>();
  private readonly schemas = new Map<string, string>();
  private readonly orgByToken = new Map<string, string>();
  private readonly feedbackForms = new Map<string, FormSubmissionRecord>();
  private readonly feedbackConfigs = new Map<string, string>();

  /** Register schemas from execution progress (same logic as WorkflowAgent). */
  extractFromExecution(
    execution: WorkflowExecution,
    organizationId?: string
  ): void {
    for (const nodeExec of execution.nodeExecutions) {
      if (nodeExec.status !== "completed" || !nodeExec.outputs) {
        continue;
      }

      const token = nodeExec.outputs.token;
      if (typeof token !== "string") {
        continue;
      }

      if (typeof nodeExec.outputs.schema === "string") {
        const schemaKey = `${token}:schema`;
        if (!this.schemas.has(schemaKey)) {
          this.schemas.set(schemaKey, nodeExec.outputs.schema);
          if (organizationId) {
            this.orgByToken.set(token, organizationId);
          }
        }
      }

      if (typeof nodeExec.outputs.feedbackFormConfig === "string") {
        const configKey = `${token}:config`;
        if (!this.feedbackConfigs.has(configKey)) {
          this.feedbackConfigs.set(
            configKey,
            nodeExec.outputs.feedbackFormConfig
          );
        }
      }
    }
  }

  getFormStatus(token: string): {
    submitted: boolean;
    schema?: string;
    organizationId?: string;
  } {
    const record = this.forms.get(token);
    const schema = this.schemas.get(`${token}:schema`);
    const organizationId = this.orgByToken.get(token);

    return {
      submitted: record?.submitted ?? false,
      ...(schema ? { schema } : {}),
      ...(organizationId ? { organizationId } : {}),
    };
  }

  async checkAndSubmitForm(
    token: string,
    executionId: string,
    response: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.forms.get(token);
    if (existing?.submitted) {
      return { success: false, error: "Form has already been submitted" };
    }

    this.forms.set(token, { submitted: true, submittedAt: Date.now() });

    nodeWorkflowEventHub.sendEvent(
      executionId,
      buildMultiplexWorkflowSendEvent(
        executionId,
        `form-response-${token}`,
        {
          outputs: { response },
          usage: 0,
        }
      )
    );

    return { success: true };
  }

  getFeedbackFormStatus(token: string): {
    submitted: boolean;
    config?: string;
  } {
    const record = this.feedbackForms.get(token);
    const config = this.feedbackConfigs.get(`${token}:config`);

    return {
      submitted: record?.submitted ?? false,
      ...(config ? { config } : {}),
    };
  }

  markFeedbackSubmitted(token: string): {
    success: boolean;
    error?: string;
  } {
    const existing = this.feedbackForms.get(token);
    if (existing?.submitted) {
      return { success: false, error: "Feedback has already been submitted" };
    }

    this.feedbackForms.set(token, { submitted: true, submittedAt: Date.now() });
    return { success: true };
  }
}

export const nodeFormStore = new NodeFormStore();
