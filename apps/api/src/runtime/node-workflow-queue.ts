import type { QueueMessage } from "@dafthunk/types";

function createQueueMessage(body: QueueMessage): Message<QueueMessage> {
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
  } as Message<QueueMessage>;
}

async function dispatchQueueMessages(messages: QueueMessage[]): Promise<void> {
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
  } as MessageBatch<QueueMessage>;

  await handleQueueMessages(batch, env, {} as ExecutionContext);
}

/**
 * In-process queue for the Node runtime.
 * `send` / `sendBatch` dispatch to `handleQueueMessages` asynchronously.
 */
export function createNodeWorkflowQueue(): Queue {
  return {
    send: async (body) => {
      void dispatchQueueMessages([body as QueueMessage]);
    },
    sendBatch: async (batch) => {
      const messages = batch.map((item) => item.body as QueueMessage);
      void dispatchQueueMessages(messages);
    },
  } as Queue;
}
