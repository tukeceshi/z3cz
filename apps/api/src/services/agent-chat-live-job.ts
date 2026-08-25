import { isClientCancelledTextModelError } from "@dafthunk/types";
import type { AgentChatStreamEvent } from "@dafthunk/types";
import type { AiInterfaceStreamEvent } from "@dafthunk/runtime/ai-interface/execute-stream";

export type AgentChatLiveJobStatus = "running" | "done" | "stopped" | "error";

export interface AgentChatLiveFinishResult {
  readonly status: "completed" | "cancelled" | "failed";
  readonly text: string;
  readonly error?: string;
  readonly aiInterfaceId: string;
}

export interface AgentChatLiveSnapshot {
  readonly text: string;
  readonly status: AgentChatLiveJobStatus;
  readonly error: string | null;
}

export interface AgentChatLiveJob {
  readonly invocationId: string;
  readonly organizationId: string;
  readonly aiInterfaceId: string;
  readonly abort: AbortController;
  readonly finished: Promise<void>;
  readonly getSnapshot: () => AgentChatLiveSnapshot;
}

interface LiveJobRecord {
  readonly invocationId: string;
  readonly organizationId: string;
  readonly aiInterfaceId: string;
  readonly abort: AbortController;
  readonly listeners: Set<(event: AgentChatStreamEvent) => void>;
  text: string;
  status: AgentChatLiveJobStatus;
  error: string | null;
  finished: Promise<void>;
}

const jobs = new Map<string, LiveJobRecord>();
const KEEP_FINISHED_MS = 10 * 60 * 1000;
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

function toPublicJob(record: LiveJobRecord): AgentChatLiveJob {
  return {
    invocationId: record.invocationId,
    organizationId: record.organizationId,
    aiInterfaceId: record.aiInterfaceId,
    abort: record.abort,
    finished: record.finished,
    getSnapshot: () => ({
      text: record.text,
      status: record.status,
      error: record.error,
    }),
  };
}

function broadcast(job: LiveJobRecord, event: AgentChatStreamEvent): void {
  for (const listener of [...job.listeners]) {
    try {
      listener(event);
    } catch {
      job.listeners.delete(listener);
    }
  }
}

function scheduleCleanup(invocationId: string): void {
  const existing = cleanupTimers.get(invocationId);
  if (existing) {
    clearTimeout(existing);
  }
  cleanupTimers.set(
    invocationId,
    setTimeout(() => {
      jobs.delete(invocationId);
      cleanupTimers.delete(invocationId);
    }, KEEP_FINISHED_MS)
  );
}

export function getAgentChatLiveJob(
  invocationId: string
): AgentChatLiveJob | null {
  const record = jobs.get(invocationId);
  return record ? toPublicJob(record) : null;
}

export function subscribeAgentChatLiveJob(
  job: AgentChatLiveJob,
  listener: (event: AgentChatStreamEvent) => void
): () => void {
  const record = jobs.get(job.invocationId);
  if (!record) {
    listener({
      type: "error",
      error: "Generation is no longer running",
    });
    return () => undefined;
  }

  listener({
    type: "snapshot",
    text: record.text,
    invocationId: record.invocationId,
  });

  if (record.status === "done") {
    listener({
      type: "done",
      text: record.text,
      invocationId: record.invocationId,
      aiInterfaceId: record.aiInterfaceId,
    });
    return () => undefined;
  }
  if (record.status === "stopped") {
    listener({
      type: "stopped",
      text: record.text,
      invocationId: record.invocationId,
    });
    return () => undefined;
  }
  if (record.status === "error") {
    listener({
      type: "error",
      error: record.error ?? "Stream failed",
    });
    return () => undefined;
  }

  record.listeners.add(listener);
  return () => {
    record.listeners.delete(listener);
  };
}

export function startAgentChatLiveJob(params: {
  readonly invocationId: string;
  readonly organizationId: string;
  readonly aiInterfaceId: string;
  readonly createStream: (
    signal: AbortSignal
  ) => AsyncIterable<AiInterfaceStreamEvent>;
  readonly onFinish: (result: AgentChatLiveFinishResult) => Promise<void>;
}): AgentChatLiveJob {
  const existing = jobs.get(params.invocationId);
  if (existing) {
    return toPublicJob(existing);
  }

  const abort = new AbortController();
  const record: LiveJobRecord = {
    invocationId: params.invocationId,
    organizationId: params.organizationId,
    aiInterfaceId: params.aiInterfaceId,
    abort,
    text: "",
    status: "running",
    error: null,
    listeners: new Set(),
    finished: Promise.resolve(),
  };

  let settled = false;
  const finish = async (
    status: AgentChatLiveJobStatus,
    result: AgentChatLiveFinishResult,
    event: AgentChatStreamEvent
  ): Promise<void> => {
    if (settled) {
      return;
    }
    settled = true;
    record.status = status;
    if (result.error) {
      record.error = result.error;
    }
    try {
      await params.onFinish(result);
    } catch {
      // invocation row must not block listeners
    }
    broadcast(record, event);
    record.listeners.clear();
    scheduleCleanup(record.invocationId);
  };

  record.finished = (async () => {
    try {
      for await (const event of params.createStream(abort.signal)) {
        if (abort.signal.aborted) {
          break;
        }
        if (event.type === "delta") {
          record.text += event.text;
          broadcast(record, { type: "delta", text: event.text });
          continue;
        }
        if (event.type === "done") {
          record.text = event.text;
          await finish(
            "done",
            {
              status: "completed",
              text: record.text,
              aiInterfaceId: record.aiInterfaceId,
            },
            {
              type: "done",
              text: record.text,
              invocationId: record.invocationId,
              aiInterfaceId: record.aiInterfaceId,
            }
          );
          return;
        }
        if (
          abort.signal.aborted ||
          isClientCancelledTextModelError(event.error)
        ) {
          break;
        }
        record.error = event.error;
        await finish(
          "error",
          {
            status: "failed",
            text: record.text,
            error: event.error,
            aiInterfaceId: record.aiInterfaceId,
          },
          { type: "error", error: event.error }
        );
        return;
      }

      if (abort.signal.aborted) {
        await finish(
          "stopped",
          {
            status: "cancelled",
            text: record.text,
            aiInterfaceId: record.aiInterfaceId,
          },
          {
            type: "stopped",
            text: record.text,
            invocationId: record.invocationId,
          }
        );
        return;
      }

      await finish(
        "error",
        {
          status: "failed",
          text: record.text,
          error: "Stream ended without completion",
          aiInterfaceId: record.aiInterfaceId,
        },
        { type: "error", error: "Stream ended without completion" }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stream failed";
      if (abort.signal.aborted || isClientCancelledTextModelError(message)) {
        await finish(
          "stopped",
          {
            status: "cancelled",
            text: record.text,
            aiInterfaceId: record.aiInterfaceId,
          },
          {
            type: "stopped",
            text: record.text,
            invocationId: record.invocationId,
          }
        );
        return;
      }
      record.error = message;
      await finish(
        "error",
        {
          status: "failed",
          text: record.text,
          error: message,
          aiInterfaceId: record.aiInterfaceId,
        },
        { type: "error", error: message }
      );
    }
  })();

  jobs.set(params.invocationId, record);
  return toPublicJob(record);
}

export async function stopAgentChatLiveJob(
  invocationId: string,
  organizationId: string
): Promise<{ readonly text: string } | null> {
  const job = jobs.get(invocationId);
  if (!job || job.organizationId !== organizationId) {
    return null;
  }
  if (job.status === "running") {
    job.abort.abort();
    await job.finished;
  }
  return { text: job.text };
}

export function createAgentChatLiveSseStream(
  job: AgentChatLiveJob
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentChatStreamEvent): void => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // subscriber already gone
        }
      };

      send({ type: "started", invocationId: job.invocationId });

      unsubscribe = subscribeAgentChatLiveJob(job, (event) => {
        send(event);
        if (
          event.type === "done" ||
          event.type === "stopped" ||
          event.type === "error"
        ) {
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });
}

export function clearAgentChatLiveJobs(): void {
  for (const timer of cleanupTimers.values()) {
    clearTimeout(timer);
  }
  cleanupTimers.clear();
  for (const job of jobs.values()) {
    job.abort.abort();
    job.listeners.clear();
  }
  jobs.clear();
}
