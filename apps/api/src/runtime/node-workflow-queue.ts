import type { WorkerQueueMessage } from "@dafthunk/types";

function createQueueMessage(
  body: WorkerQueueMessage
): Message<WorkerQueueMessage> {
  let acked = false;

  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    body,
    attempts: 1,
    ack: () => {
      acked = true;
    },
    retry: () => {
      if (!acked) {
        void dispatchQueueMessages([body]);
      }
    },
  } as Message<WorkerQueueMessage>;
}

async function dispatchQueueMessages(
  messages: WorkerQueueMessage[]
): Promise<void> {
  const { getNodeBindings } = await import("../env/node-bindings-ref");
  const { handleQueueMessages } = await import("../queue");

  const env = getNodeBindings();
  const batch = {
    queue: "workflow",
    messages: messages.map(createQueueMessage),
    ackAll: () => undefined,
    retryAll: () => {
      void dispatchQueueMessages(messages);
    },
  } as unknown as MessageBatch<WorkerQueueMessage>;

  await handleQueueMessages(batch, env, {} as ExecutionContext);
}

/**
 * In-process queue for the Node runtime.
 * `send` / `sendBatch` dispatch to `handleQueueMessages` asynchronously.
 */
export function createNodeWorkflowQueue(): Queue {
  return {
    send: async (body: unknown) => {
      void dispatchQueueMessages([body as WorkerQueueMessage]);
    },
    sendBatch: async (batch: Iterable<{ body: unknown }>) => {
      const messages = [...batch].map(
        (item) => item.body as WorkerQueueMessage
      );
      void dispatchQueueMessages(messages);
    },
  } as unknown as Queue;
}
