import type { ToolDefinition } from "@dafthunk/runtime";
import type {
  AgentLoopState,
  AgentMessage,
  FinishReason,
  ResolvedToolResult,
} from "@dafthunk/runtime/utils/agent-loop";
import { runAgentLoop } from "@dafthunk/runtime/utils/agent-loop";
import { calculateTokenUsage } from "@dafthunk/runtime/utils/usage";

import type { Bindings } from "../context";
import { buildMultiplexWorkflowSendEvent } from "./workflow-event-utils";
import { createDatabase, getEmail } from "../db";
import {
  applyCodeMode,
  buildNodeToolProvider,
  resolveTools,
  toJsonSchema,
} from "../durable-objects/agent-services";
import { callAgentLLM } from "../durable-objects/agent-llm";
import {
  allSettled,
  nextWaitingDeadline,
  type PendingAsk,
  settleExpired,
  settleReply,
  toResumeResults,
} from "../durable-objects/email-agent-barrier";
import type {
  EmailAgentRunRequest,
  EmailInterlocutor,
} from "../durable-objects/email-agent-runner";
import type { MailboxMessageRow } from "../durable-objects/mailbox-do";
import { getNodeBindings } from "../env/node-bindings-ref";
import { CloudflareMailboxService } from "./cloudflare-mailbox-service";

const ASK_TOOL = "ask_interlocutor";
const NO_REPLY_SENTINEL = "(no reply received before the deadline)";

interface ThreadRef {
  threadId: string;
  subject: string;
}

interface TranscriptThread {
  interlocutorId: string;
  threadId: string;
  timedOut: boolean;
  messages: MailboxMessageRow[];
}

interface EmailCompletion {
  result: string;
  transcript: TranscriptThread[];
  rounds: number;
  finishReason: "goal_reached" | "max_rounds" | "error";
  totalInputTokens: number;
  totalOutputTokens: number;
  usage: number;
  error?: string;
}

type RunStatus = "running" | "waiting" | "completed" | "error";

const FINISH_REASON: Record<FinishReason, EmailCompletion["finishReason"]> = {
  completed: "goal_reached",
  max_steps_reached: "max_rounds",
  error: "error",
};

class NodeEmailAgentRunnerInstance {
  private readonly storage = new Map<string, unknown>();
  private alarmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly env: Bindings) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/start") && request.method === "POST") {
      const body = (await request.json()) as EmailAgentRunRequest;
      return Response.json(await this.start(body));
    }
    return new Response("Not found", { status: 404 });
  }

  async deliverReply(args: {
    threadId: string;
    text: string;
  }): Promise<{ accepted: boolean }> {
    const pending = this.get<PendingAsk[]>("pending") ?? [];
    if (!settleReply(pending, args.threadId, args.text)) {
      return { accepted: false };
    }

    this.set("pending", pending);

    if (allSettled(pending)) {
      this.clearAlarm();
      void this.resumeFromPending(pending);
    }
    return { accepted: true };
  }

  async start(request: EmailAgentRunRequest): Promise<{ status: string }> {
    const status = this.get<RunStatus>("status");

    if (status === "completed") {
      const cached = this.get<EmailCompletion>("completion");
      if (cached) {
        await this.sendCompletionEvent(request, cached);
      }
      return { status: "completed" };
    }
    if (status === "running" || status === "waiting") {
      return { status };
    }

    const db = createDatabase(this.env);
    const email = await getEmail(
      db,
      request.fromEmailId,
      request.organizationId
    );
    if (!email) {
      await this.fail(
        request,
        `Sending address '${request.fromEmailId}' not found for this organization`
      );
      return { status: "error" };
    }

    this.set("request", request);
    this.set("emailId", email.id);
    this.set("status", "running" satisfies RunStatus);

    void this.runLoop();
    return { status: "started" };
  }

  private async runLoop(resume?: ResolvedToolResult[]): Promise<void> {
    const request = this.get<EmailAgentRunRequest>("request");
    if (!request) {
      return;
    }

    try {
      const state = this.get<AgentLoopState>("state");
      const tools = await this.buildTools(request);
      const jsonSchema = toJsonSchema(request.schema);
      const instructions = this.systemPrompt(request);

      const llm = (
        messages: AgentMessage[],
        llmTools: ToolDefinition[],
        schema?: Record<string, unknown>
      ) =>
        callAgentLLM(this.env, {
          provider: request.provider,
          model: request.model,
          instructions,
          messages,
          tools: llmTools,
          schema,
        });

      const outcome = await runAgentLoop({
        userMessage: this.userMessage(request),
        tools,
        maxSteps: Math.max(1, request.maxRounds),
        callLLM: (messages, llmTools) => llm(messages, llmTools),
        callFinalLLM: jsonSchema
          ? (messages, llmTools) => llm(messages, llmTools, jsonSchema)
          : undefined,
        isSuspendingTool: (name) => name === ASK_TOOL,
        ...(state ? { resumeState: state } : {}),
        ...(resume ? { resumeToolResults: resume } : {}),
      });

      if (outcome.status === "suspended") {
        this.set("state", outcome.state);
        await this.parkOnAsks(request, outcome.pendingToolCalls);
        return;
      }

      const finishReason = FINISH_REASON[outcome.finishReason];
      const usage = request.pricing
        ? calculateTokenUsage(
            outcome.totalInputTokens,
            outcome.totalOutputTokens,
            request.pricing
          )
        : 1;

      await this.complete(request, {
        result: outcome.text,
        transcript: await this.buildTranscript(request),
        rounds: outcome.totalSteps,
        finishReason,
        totalInputTokens: outcome.totalInputTokens,
        totalOutputTokens: outcome.totalOutputTokens,
        usage,
        ...(finishReason === "error" ? { error: outcome.text } : {}),
      });
    } catch (error) {
      console.error("NodeEmailAgentRunner runLoop error:", error);
      await this.fail(
        request,
        error instanceof Error ? error.message : "Email agent failed"
      );
    }
  }

  private async parkOnAsks(
    request: EmailAgentRunRequest,
    asks: { id: string; name: string; arguments: Record<string, unknown> }[]
  ): Promise<void> {
    const mailbox = new CloudflareMailboxService(this.env);
    const mailboxStub = this.mailboxStub(request.organizationId);
    const emailId = this.get<string>("emailId") ?? "";
    const threads = this.get<Record<string, ThreadRef>>("threads") ?? {};

    const deadline = Date.now() + request.replyTimeoutMs;
    const pending: PendingAsk[] = [];

    for (const ask of asks) {
      const interlocutorId = String(ask.arguments.interlocutor ?? "");
      const message = String(ask.arguments.message ?? "");
      const who = resolveInterlocutor(request.interlocutors, interlocutorId);

      if (!who || !message) {
        pending.push({
          toolCallId: ask.id,
          interlocutorId,
          threadId: "",
          deadline,
          status: "settled",
          result: who
            ? "(no message provided)"
            : `(unknown interlocutor '${interlocutorId}')`,
        });
        continue;
      }

      const existing = threads[who.id];
      const subject = existing
        ? `Re: ${existing.subject.replace(/^re:\s*/i, "")}`
        : (ask.arguments.subject as string) ||
          request.subject ||
          `Regarding: ${request.objective.slice(0, 60)}`;

      try {
        const sent = await mailbox.sendThreaded({
          organizationId: request.organizationId,
          emailId,
          to: who.email,
          subject,
          text: message,
          ...(existing ? { threadId: existing.threadId } : {}),
        });

        threads[who.id] = {
          threadId: sent.threadId,
          subject: existing?.subject ?? subject,
        };
        await mailboxStub.setThreadAgentRun(sent.threadId, request.runId);
        pending.push({
          toolCallId: ask.id,
          interlocutorId: who.id,
          threadId: sent.threadId,
          deadline,
          status: "waiting",
        });
      } catch (error) {
        pending.push({
          toolCallId: ask.id,
          interlocutorId: who.id,
          threadId: "",
          deadline,
          status: "settled",
          result: `(failed to send: ${
            error instanceof Error ? error.message : "unknown error"
          })`,
        });
      }
    }

    this.set("threads", threads);
    this.set("pending", pending);
    this.set("status", "waiting" satisfies RunStatus);

    if (allSettled(pending)) {
      void this.resumeFromPending(pending);
    } else {
      this.scheduleAlarm(deadline);
    }
  }

  private async resumeFromPending(pending: PendingAsk[]): Promise<void> {
    const resume = toResumeResults(pending, ASK_TOOL, NO_REPLY_SENTINEL);
    this.storage.delete("pending");
    this.set("status", "running" satisfies RunStatus);
    await this.runLoop(resume);
  }

  private async onAlarm(): Promise<void> {
    const pending = this.get<PendingAsk[]>("pending") ?? [];
    if (pending.length === 0) {
      return;
    }

    const expired = settleExpired(pending, Date.now(), NO_REPLY_SENTINEL);
    if (expired.length > 0) {
      this.set("pending", pending);
      await this.markTimedOut(expired.map((p) => p.threadId));
    }

    if (allSettled(pending)) {
      void this.resumeFromPending(pending);
    } else {
      const next = nextWaitingDeadline(pending);
      if (next !== undefined) {
        this.scheduleAlarm(next);
      }
    }
  }

  private async complete(
    request: EmailAgentRunRequest,
    completion: EmailCompletion
  ): Promise<void> {
    this.set("completion", completion);
    this.set("status", "completed" satisfies RunStatus);
    this.clearAlarm();
    await this.releaseThreads(request.organizationId);
    await this.sendCompletionEvent(request, completion);
  }

  private async fail(
    request: EmailAgentRunRequest,
    message: string
  ): Promise<void> {
    this.set("status", "error" satisfies RunStatus);
    this.clearAlarm();
    try {
      await this.releaseThreads(request.organizationId);
    } catch {
      // best-effort
    }
    try {
      const instance = await this.env.EXECUTE.get(request.executionInstanceId);
      await instance.sendEvent(
        buildMultiplexWorkflowSendEvent(
          request.executionInstanceId,
          `email-agent-complete-${request.nodeId}`,
          { outputs: {}, usage: 0, error: message },
          request.nodeId
        )
      );
    } catch (error) {
      console.error("NodeEmailAgentRunner failed to send error event:", error);
    }
  }

  private async sendCompletionEvent(
    request: EmailAgentRunRequest,
    completion: EmailCompletion
  ): Promise<void> {
    const instance = await this.env.EXECUTE.get(request.executionInstanceId);
    await instance.sendEvent(
      buildMultiplexWorkflowSendEvent(
        request.executionInstanceId,
        `email-agent-complete-${request.nodeId}`,
        {
          outputs: {
            result: completion.result,
            transcript: completion.transcript,
            rounds: completion.rounds,
            finish_reason: completion.finishReason,
            usage_metadata: {
              totalInputTokens: completion.totalInputTokens,
              totalOutputTokens: completion.totalOutputTokens,
            },
          },
          usage: completion.usage,
          ...(completion.error ? { error: completion.error } : {}),
        },
        request.nodeId
      )
    );
  }

  private async buildTools(
    request: EmailAgentRunRequest
  ): Promise<ToolDefinition[]> {
    const askTool: ToolDefinition = {
      name: ASK_TOOL,
      description:
        "Email a specific interlocutor and wait for their reply. Issue multiple " +
        "calls in one turn to ask several interlocutors in parallel.",
      parameters: {
        type: "object",
        properties: {
          interlocutor: {
            type: "string",
            enum: request.interlocutors.map((i) => i.id),
            description: "Id of the interlocutor to email",
          },
          message: {
            type: "string",
            description: "The email body to send (plain text)",
          },
          subject: {
            type: "string",
            description: "Optional subject for a new thread",
          },
        },
        required: ["interlocutor", "message"],
      },
      function: async () => NO_REPLY_SENTINEL,
    };

    const userTools = request.tools?.length
      ? applyCodeMode(
          this.env,
          await resolveTools(
            request.tools,
            await buildNodeToolProvider(this.env, request.organizationId)
          ),
          false
        )
      : [];

    return [askTool, ...userTools];
  }

  private systemPrompt(request: EmailAgentRunRequest): string {
    const roster = request.interlocutors
      .map((i) => {
        const bits = [i.role && `role=${i.role}`, i.name && `name=${i.name}`]
          .filter(Boolean)
          .join(", ");
        return `- id=${i.id}${bits ? ` (${bits})` : ""}`;
      })
      .join("\n");

    const persona = request.instructions?.trim();
    return [
      persona,
      "You coordinate with interlocutors over email to accomplish the objective. " +
        `Use the ${ASK_TOOL} tool to email an interlocutor and wait for their reply. ` +
        "You may contact several interlocutors in parallel by issuing multiple " +
        `${ASK_TOOL} calls in a single turn. A reply of "${NO_REPLY_SENTINEL}" ` +
        "means that interlocutor did not respond in time — decide how to proceed. " +
        "When you have achieved the objective, stop calling tools and give your final result.",
      `Interlocutors you may contact:\n${roster}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private userMessage(request: EmailAgentRunRequest): string {
    return request.context
      ? `Objective:\n${request.objective}\n\nContext:\n${request.context}`
      : `Objective:\n${request.objective}`;
  }

  private mailboxStub(organizationId: string) {
    return this.env.MAILBOX.get(
      this.env.MAILBOX.idFromName(`mailbox:${organizationId}`)
    );
  }

  private async markTimedOut(threadIds: string[]): Promise<void> {
    const timedOut = this.get<string[]>("timedOut") ?? [];
    timedOut.push(...threadIds);
    this.set("timedOut", timedOut);
  }

  private async releaseThreads(organizationId: string): Promise<void> {
    const threads = this.get<Record<string, ThreadRef>>("threads") ?? {};
    const stub = this.mailboxStub(organizationId);
    await Promise.all(
      Object.values(threads).map((ref) =>
        stub.setThreadAgentRun(ref.threadId, null)
      )
    );
  }

  private async buildTranscript(
    request: EmailAgentRunRequest
  ): Promise<TranscriptThread[]> {
    const threads = this.get<Record<string, ThreadRef>>("threads") ?? {};
    const timedOut = new Set(this.get<string[]>("timedOut") ?? []);
    const stub = this.mailboxStub(request.organizationId);

    return Promise.all(
      Object.entries(threads).map(async ([interlocutorId, ref]) => ({
        interlocutorId,
        threadId: ref.threadId,
        timedOut: timedOut.has(ref.threadId),
        messages: await stub.listThreadMessages(ref.threadId),
      }))
    );
  }

  private get<T>(key: string): T | undefined {
    return this.storage.get(key) as T | undefined;
  }

  private set(key: string, value: unknown): void {
    this.storage.set(key, value);
  }

  private scheduleAlarm(deadlineMs: number): void {
    this.clearAlarm();
    const delay = Math.max(0, deadlineMs - Date.now());
    this.alarmTimer = setTimeout(() => {
      void this.onAlarm();
    }, delay);
  }

  private clearAlarm(): void {
    if (this.alarmTimer) {
      clearTimeout(this.alarmTimer);
      this.alarmTimer = null;
    }
  }
}

class NodeEmailAgentRunnerHub {
  private readonly instances = new Map<string, NodeEmailAgentRunnerInstance>();

  get(name: string): NodeEmailAgentRunnerInstance {
    const existing = this.instances.get(name);
    if (existing) {
      return existing;
    }
    const instance = new NodeEmailAgentRunnerInstance(getNodeBindings());
    this.instances.set(name, instance);
    return instance;
  }
}

const nodeEmailAgentRunnerHub = new NodeEmailAgentRunnerHub();

export function createNodeEmailAgentRunnerNamespace(): DurableObjectNamespace {
  return {
    idFromName: (name: string) =>
      ({ toString: () => name }) as DurableObjectId,
    idFromString: (id: string) => ({ toString: () => id }) as DurableObjectId,
    newUniqueId: () =>
      ({ toString: () => crypto.randomUUID() }) as DurableObjectId,
    get: (id: DurableObjectId) => {
      const name = id.toString();
      const instance = nodeEmailAgentRunnerHub.get(name);
      return {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const request =
            input instanceof Request ? input : new Request(input, init);
          return instance.fetch(request);
        },
        deliverReply: (args: { threadId: string; text: string }) =>
          instance.deliverReply(args),
      } as DurableObjectStub;
    },
  } as DurableObjectNamespace;
}

function resolveInterlocutor(
  interlocutors: EmailInterlocutor[],
  ref: string
): EmailInterlocutor | undefined {
  const needle = ref.trim().toLowerCase();
  return (
    interlocutors.find((i) => i.id.toLowerCase() === needle) ??
    interlocutors.find((i) => i.email.toLowerCase() === needle) ??
    interlocutors.find((i) => i.name?.toLowerCase() === needle)
  );
}
