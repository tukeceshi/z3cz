import type {
  QueueMessage,
  VolcanoInterfaceSetupQueueMessage,
  WorkerQueueMessage,
} from "@dafthunk/types";
import { isVolcanoInterfaceSetupQueueMessage } from "@dafthunk/types";

import type { Bindings } from "./context";
import { createDatabase } from "./db";
import { getQueueTriggersByQueue } from "./db/queries";
import { processVolcanoInterfaceSetup } from "./integrations/volcengine/process-volcano-interface-setup";
import { WorkflowStore } from "./stores/workflow-store";

async function processWorkflowQueueMessage(
  message: Message,
  _env: Bindings,
  _ctx: ExecutionContext,
  db: ReturnType<typeof createDatabase>,
  _workflowStore: WorkflowStore
): Promise<void> {
  const queueMessage = message.body as QueueMessage;

  console.log(
    `Processing message for queue: ${queueMessage.queueId}, org: ${queueMessage.organizationId}`
  );

  const triggers = await getQueueTriggersByQueue(
    db,
    queueMessage.queueId,
    queueMessage.organizationId
  );

  if (triggers.length === 0) {
    console.log(`No active triggers found for queue ${queueMessage.queueId}`);
    message.ack();
    return;
  }

  console.log(`Found ${triggers.length} active triggers for this queue.`);

  for (const { workflow } of triggers) {
    console.log(
      `Skipping queue trigger for workflow ${workflow.id}: full workflow execution is disabled`
    );
  }

  message.ack();
  console.log(`Message acknowledged for queue ${queueMessage.queueId}`);
}

async function processVolcanoSetupMessage(
  message: Message,
  env: Bindings
): Promise<void> {
  const body = message.body as VolcanoInterfaceSetupQueueMessage;
  console.log(
    `[volcano-setup] processing interface=${body.interfaceId} org=${body.organizationId}`
  );
  try {
    await processVolcanoInterfaceSetup(env, body);
    message.ack();
  } catch (error) {
    console.error("[volcano-setup] consumer error:", error);
    message.retry();
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
        const body = message.body as WorkerQueueMessage;
        if (isVolcanoInterfaceSetupQueueMessage(body)) {
          await processVolcanoSetupMessage(message, env);
          continue;
        }
        await processWorkflowQueueMessage(
          message,
          env,
          ctx,
          db,
          workflowStore
        );
      } catch (messageError) {
        console.error("Error processing queue message:", messageError);
        message.retry();
      }
    }
  } catch (batchError) {
    console.error("Error processing queue batch:", batchError);
  }
}
