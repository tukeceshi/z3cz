import type { QueueMessage, Workflow } from "@dafthunk/types";
import type { Bindings } from "./context";
import { createDatabase } from "./db";
import {
  getOrganizationBillingInfo,
  getQueueTriggersByQueue,
  resolveOrganizationBillingOptions,
} from "./db/queries";
import { WorkflowStore } from "./stores/workflow-store";
import { isCreditExhausted, shouldSkipPlatformCreditCheck } from "./utils/credits";

// This function handles the actual execution triggering
async function executeWorkflow(
  workflowInfo: {
    id: string;
    name: string;
    organizationId: string;
  },
  workflowData: Workflow,
  queueMessage: QueueMessage,
  db: ReturnType<typeof createDatabase>,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  console.log(
    `Attempting to execute workflow ${workflowInfo.id} via queue message.`
  );

  try {
    // Get organization billing info
    const billingInfo = await getOrganizationBillingInfo(
      db,
      workflowInfo.organizationId
    );
    if (billingInfo === undefined) {
      console.error("Organization not found");
      return;
    }

    const billingMode = workflowData.billingMode ?? "platform";

    if (
      !shouldSkipPlatformCreditCheck(billingMode) &&
      isCreditExhausted(billingInfo, env.CLOUDFLARE_ENV)
    ) {
      console.log(
        `Skipping queue trigger for workflow ${workflowInfo.id}: credits exhausted`
      );
      return;
    }

    const billingOptions = resolveOrganizationBillingOptions(
      billingInfo,
      env.CLOUDFLARE_ENV
    );

    const executionParams = {
      userId: "queue_trigger",
      organizationId: workflowInfo.organizationId,
      ...billingOptions,
      workflow: {
        id: workflowInfo.id,
        name: workflowData.name,
        schemeId: workflowData.schemeId,
        billingMode,
        trigger: workflowData.trigger,
        runtime: workflowData.runtime,
        nodes: workflowData.nodes,
        edges: workflowData.edges,
      },
      queueMessage: {
        queueId: queueMessage.queueId,
        organizationId: queueMessage.organizationId,
        payload: queueMessage.payload,
        timestamp: queueMessage.timestamp,
      },
    };

    const { startWorkflowExecution } = await import(
      "./runtime/start-workflow-execution"
    );
    const result = await startWorkflowExecution(env, executionParams);
    console.log(
      `[Execution] ${result.executionId} workflow=${workflowInfo.id} runtime=${workflowData.runtime} trigger=queue` +
        (result.status ? ` status=${result.status}` : "")
    );
  } catch (execError) {
    console.error(`Error executing workflow ${workflowInfo.id}:`, execError);
  }
}

export async function handleQueueMessages(
  batch: MessageBatch,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`Queue batch received with ${batch.messages.length} messages`);
  const db = createDatabase(env);
  const workflowStore = new WorkflowStore(env);

  try {
    for (const message of batch.messages) {
      try {
        // Parse the message body
        const queueMessage = message.body as QueueMessage;

        console.log(
          `Processing message for queue: ${queueMessage.queueId}, org: ${queueMessage.organizationId}`
        );

        // Get all active queue triggers for this queue
        const triggers = await getQueueTriggersByQueue(
          db,
          queueMessage.queueId,
          queueMessage.organizationId
        );

        if (triggers.length === 0) {
          console.log(
            `No active triggers found for queue ${queueMessage.queueId}`
          );
          message.ack();
          continue;
        }

        console.log(`Found ${triggers.length} active triggers for this queue.`);

        // Deduplicate workflows to avoid loading same workflow multiple times
        const workflowCache = new Map<
          string,
          {
            data: Workflow;
            workflow: (typeof triggers)[0]["workflow"];
          }
        >();

        // Load each unique workflow once
        for (const item of triggers) {
          const { workflow } = item;

          if (workflowCache.has(workflow.id)) {
            continue; // Already loaded this workflow
          }

          // Skip workflows that are not enabled
          if (!workflow.enabled) {
            console.log(`Skipping workflow ${workflow.id}: not enabled`);
            continue;
          }

          console.log(`Loading workflow: ${workflow.id}`);

          try {
            const workflowWithData = await workflowStore.getWithData(
              workflow.id,
              workflow.organizationId
            );
            if (!workflowWithData) {
              console.error(
                `Failed to load workflow data for ${workflow.id}: not found`
              );
              continue;
            }

            workflowCache.set(workflow.id, {
              data: workflowWithData.data,
              workflow,
            });
          } catch (err) {
            console.error(`Error loading workflow ${workflow.id}:`, err);
          }
        }

        // Execute each trigger with its corresponding workflow
        for (const item of triggers) {
          const { workflow } = item;
          const cached = workflowCache.get(workflow.id);

          if (!cached) {
            console.log(
              `Skipping trigger for workflow ${workflow.id}: failed to load`
            );
            continue;
          }

          console.log(`Executing trigger for workflow: ${workflow.id}`);

          try {
            const workflowInfo = {
              id: workflow.id,
              name: workflow.name,
              organizationId: workflow.organizationId,
            };

            await executeWorkflow(
              workflowInfo,
              cached.data,
              queueMessage,
              db,
              env,
              ctx
            );
          } catch (err) {
            console.error(`Error executing workflow ${workflow.id}:`, err);
          }
        }

        // Acknowledge the message after processing all triggers
        message.ack();
        console.log(`Message acknowledged for queue ${queueMessage.queueId}`);
      } catch (messageError) {
        console.error("Error processing queue message:", messageError);
        // Retry the message by not acknowledging it
        message.retry();
      }
    }
  } catch (batchError) {
    console.error("Error processing queue batch:", batchError);
  }
}
