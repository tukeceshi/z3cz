import { afterEach, describe, expect, it } from "vitest";

import type { AiInterfaceStreamEvent } from "@dafthunk/runtime/ai-interface/execute-stream";

import {
  clearAgentChatLiveJobs,
  getAgentChatLiveJob,
  startAgentChatLiveJob,
  stopAgentChatLiveJob,
  subscribeAgentChatLiveJob,
} from "./agent-chat-live-job";

afterEach(() => {
  clearAgentChatLiveJobs();
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function* delayedHello(
  signal: AbortSignal
): AsyncGenerator<AiInterfaceStreamEvent> {
  yield { type: "delta", text: "hel" };
  await sleep(40);
  if (signal.aborted) {
    return;
  }
  yield { type: "delta", text: "lo" };
  yield { type: "done", text: "hello" };
}

describe("agent-chat-live-job", () => {
  it("keeps generating after a subscriber leaves", async () => {
    const finishes: string[] = [];
    const job = startAgentChatLiveJob({
      invocationId: "inv-1",
      organizationId: "org-1",
      aiInterfaceId: "iface-1",
      createStream: (signal) => delayedHello(signal),
      onFinish: async (result) => {
        finishes.push(result.status);
      },
    });

    const first: string[] = [];
    const unsubscribe = subscribeAgentChatLiveJob(job, (event) => {
      first.push(event.type);
    });
    unsubscribe();

    await job.finished;
    expect(job.getSnapshot().text).toBe("hello");
    expect(finishes).toEqual(["completed"]);

    const second: string[] = [];
    subscribeAgentChatLiveJob(job, (event) => {
      second.push(`${event.type}:${"text" in event ? event.text : ""}`);
    });
    expect(second[0]).toBe("snapshot:hello");
    expect(second[1]).toBe("done:hello");
  });

  it("stop aborts the upstream signal and cannot continue as running", async () => {
    let seenAbort = false;
    const job = startAgentChatLiveJob({
      invocationId: "inv-2",
      organizationId: "org-1",
      aiInterfaceId: "iface-1",
      createStream: async function* (signal) {
        signal.addEventListener("abort", () => {
          seenAbort = true;
        });
        yield { type: "delta", text: "x" };
        await sleep(400);
        yield { type: "done", text: "x" };
      },
      onFinish: async () => undefined,
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (job.getSnapshot().text === "x") {
        break;
      }
      await sleep(10);
    }

    const stopped = await stopAgentChatLiveJob("inv-2", "org-1");
    expect(seenAbort).toBe(true);
    expect(stopped?.text).toBe("x");
    expect(job.getSnapshot().status).toBe("stopped");

    const replay: string[] = [];
    subscribeAgentChatLiveJob(job, (event) => {
      replay.push(event.type);
    });
    expect(replay).toEqual(["snapshot", "stopped"]);
  });

  it("ignores stop for another organization", async () => {
    startAgentChatLiveJob({
      invocationId: "inv-3",
      organizationId: "org-1",
      aiInterfaceId: "iface-1",
      createStream: (signal) => delayedHello(signal),
      onFinish: async () => undefined,
    });

    const stopped = await stopAgentChatLiveJob("inv-3", "org-other");
    expect(stopped).toBeNull();
    expect(getAgentChatLiveJob("inv-3")?.getSnapshot().status).toBe("running");
  });
});
