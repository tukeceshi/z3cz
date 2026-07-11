import type { ToolDefinition } from "@dafthunk/runtime";
import type {
  AgentLoopResult,
  AgentLoopState,
  AgentMessage,
  LLMResponse,
} from "@dafthunk/runtime/utils/agent-loop";
import { runAgentLoop } from "@dafthunk/runtime/utils/agent-loop";
import { calculateTokenUsage } from "@dafthunk/runtime/utils/usage";

import type { Bindings } from "../context";
import { buildMultiplexWorkflowSendEvent } from "./workflow-event-utils";
import {
  applyCodeMode,
  buildNodeToolProvider,
  resolveTools,
  toJsonSchema,
} from "../durable-objects/agent-services";
import { callAgentLLM } from "../durable-objects/agent-llm";
import type {
  AgentRunRequest,
  AgentRunResponse,
  AgentRunnerState,
} from "../durable-objects/agent-runner";
import { getNodeBindings } from "../env/node-bindings-ref";

interface RunRecord {
  status: "running" | "completed" | "error";
  result?: AgentRunResponse;
  state?: AgentLoopState;
}

class NodeAgentRunnerInstance {
  private conversationState: AgentRunnerState | null = null;
  private readonly runs = new Map<string, RunRecord>();

  constructor(private readonly env: Bindings) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/run") && request.method === "POST") {
      return this.handleRun(request);
    }
    if (url.pathname.endsWith("/start") && request.method === "POST") {
      return this.handleStart(request);
    }
    return new Response("Not found", { status: 404 });
  }

  private async handleRun(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as AgentRunRequest;
      const { runId } = body;
      const existing = this.runs.get(runId);

      if (existing?.status === "completed" && existing.result) {
        return Response.json(existing.result);
      }

      this.runs.set(runId, { status: "running" });

      const nodeToolProvider = await buildNodeToolProvider(
        this.env,
        body.organizationId
      );
      const resolvedTools = await resolveTools(body.tools, nodeToolProvider);
      const toolDefinitions = applyCodeMode(
        this.env,
        resolvedTools,
        body.codeMode ?? false
      );

      const userMessage = body.context
        ? `Context:\n${body.context}\n\nRequest:\n${body.input}`
        : body.input;

      const resumeState = this.buildResumeState(
        body.agentId,
        userMessage,
        body.maxHistory ?? 50
      );

      const { callLLM, callFinalLLM } = this.buildLlmCallbacks(body);

      const result = await runAgentLoop({
        userMessage,
        tools: toolDefinitions,
        maxSteps: body.maxSteps,
        callLLM,
        callFinalLLM,
        onStepComplete: async (state) => {
          const record = this.runs.get(runId) ?? { status: "running" };
          record.state = state;
          this.runs.set(runId, record);
        },
        resumeState,
      });

      if (result.status === "suspended") {
        throw new Error("Agent loop suspended unexpectedly");
      }

      const agentMessages = this.persistConversationState(
        body.agentId,
        userMessage,
        result
      );

      const response: AgentRunResponse = {
        text: result.text,
        steps: result.steps,
        finishReason: result.finishReason,
        totalSteps: result.totalSteps,
        totalInputTokens: result.totalInputTokens,
        totalOutputTokens: result.totalOutputTokens,
        ...(agentMessages && { agentMessages }),
      };

      this.runs.set(runId, { status: "completed", result: response });
      return Response.json(response);
    } catch (error) {
      console.error("NodeAgentRunner /run error:", error);
      return Response.json(
        {
          error: "Failed to run agent",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  private async handleStart(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as AgentRunRequest;
      const { runId, executionInstanceId, nodeId, pricing } = body;

      if (!executionInstanceId || !nodeId) {
        return Response.json(
          { error: "executionInstanceId and nodeId are required for /start" },
          { status: 400 }
        );
      }

      const existing = this.runs.get(runId);
      if (existing?.status === "completed" && existing.result) {
        const usage = pricing
          ? calculateTokenUsage(
              existing.result.totalInputTokens,
              existing.result.totalOutputTokens,
              pricing
            )
          : 1;
        await this.sendCompletionEvent(
          executionInstanceId,
          nodeId,
          existing.result,
          usage
        );
        return Response.json({ status: "completed" });
      }

      this.runs.set(runId, { status: "running" });
      void this.runAgentInBackground(body);

      return Response.json({ status: "started" });
    } catch (error) {
      console.error("NodeAgentRunner /start error:", error);
      return Response.json(
        {
          error: "Failed to start agent",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  private async runAgentInBackground(body: AgentRunRequest): Promise<void> {
    const { runId, executionInstanceId, nodeId, pricing } = body;

    try {
      const nodeToolProvider = await buildNodeToolProvider(
        this.env,
        body.organizationId
      );
      const resolvedTools = await resolveTools(body.tools, nodeToolProvider);
      const toolDefinitions = applyCodeMode(
        this.env,
        resolvedTools,
        body.codeMode ?? false
      );

      const userMessage = body.context
        ? `Context:\n${body.context}\n\nRequest:\n${body.input}`
        : body.input;

      const resumeState = this.buildResumeState(
        body.agentId,
        userMessage,
        body.maxHistory ?? 50
      );

      const { callLLM, callFinalLLM } = this.buildLlmCallbacks(body);

      const result = await runAgentLoop({
        userMessage,
        tools: toolDefinitions,
        maxSteps: body.maxSteps,
        callLLM,
        callFinalLLM,
        onStepComplete: async (state) => {
          const record = this.runs.get(runId) ?? { status: "running" };
          record.state = state;
          this.runs.set(runId, record);
        },
        resumeState,
      });

      if (result.status === "suspended") {
        throw new Error("Agent loop suspended unexpectedly");
      }

      const agentMessages = this.persistConversationState(
        body.agentId,
        userMessage,
        result
      );

      const response: AgentRunResponse = {
        text: result.text,
        steps: result.steps,
        finishReason: result.finishReason,
        totalSteps: result.totalSteps,
        totalInputTokens: result.totalInputTokens,
        totalOutputTokens: result.totalOutputTokens,
        ...(agentMessages && { agentMessages }),
      };

      this.runs.set(runId, { status: "completed", result: response });

      const usage = pricing
        ? calculateTokenUsage(
            result.totalInputTokens,
            result.totalOutputTokens,
            pricing
          )
        : 1;

      await this.sendCompletionEvent(
        executionInstanceId!,
        nodeId!,
        response,
        usage
      );
    } catch (error) {
      console.error("NodeAgentRunner background error:", error);
      this.runs.set(runId, { status: "error" });

      if (executionInstanceId && nodeId) {
        try {
          const instance = await this.env.EXECUTE.get(executionInstanceId);
          await instance.sendEvent(
            buildMultiplexWorkflowSendEvent(
              executionInstanceId,
              `agent-complete-${nodeId}`,
              {
                outputs: {},
                usage: 0,
                error:
                  error instanceof Error
                    ? error.message
                    : "Agent execution failed",
              },
              nodeId
            )
          );
        } catch (sendError) {
          console.error("Failed to send error event to workflow:", sendError);
        }
      }
    }
  }

  private async sendCompletionEvent(
    executionInstanceId: string,
    nodeId: string,
    response: AgentRunResponse,
    usage: number
  ): Promise<void> {
    const instance = await this.env.EXECUTE.get(executionInstanceId);
    await instance.sendEvent(
      buildMultiplexWorkflowSendEvent(
        executionInstanceId,
        `agent-complete-${nodeId}`,
        {
          outputs: {
            text: response.text,
            steps: response.steps,
            total_steps: response.totalSteps,
            finish_reason: response.finishReason,
            usage_metadata: {
              totalInputTokens: response.totalInputTokens,
              totalOutputTokens: response.totalOutputTokens,
            },
            ...(response.agentMessages && {
              agent_messages: response.agentMessages,
            }),
          },
          usage,
          ...(response.finishReason === "error" && {
            error: response.text || "Agent execution failed",
          }),
        },
        nodeId
      )
    );
  }

  private buildResumeState(
    agentId: string | undefined,
    userMessage: string,
    maxHistory: number
  ): AgentLoopState | undefined {
    if (!agentId) {
      return undefined;
    }
    const prev = this.conversationState?.messages;
    if (!prev || prev.length === 0) {
      return undefined;
    }

    const trimmed =
      prev.length > maxHistory ? prev.slice(-maxHistory) : prev;

    return {
      messages: [...trimmed, { role: "user" as const, content: userMessage }],
      steps: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  private persistConversationState(
    agentId: string | undefined,
    userMessage: string,
    result: AgentLoopResult
  ): AgentMessage[] | undefined {
    if (!agentId) {
      return undefined;
    }

    const prevMessages = this.conversationState?.messages ?? [];
    const newMessages: AgentMessage[] = [
      { role: "user", content: userMessage },
    ];
    for (const step of result.steps) {
      newMessages.push(step.assistantMessage);
      newMessages.push(...step.toolResults);
    }
    newMessages.push({ role: "assistant", content: result.text });

    const allMessages = [...prevMessages, ...newMessages];
    this.conversationState = {
      messages: allMessages,
      totalInputTokens:
        (this.conversationState?.totalInputTokens ?? 0) +
        result.totalInputTokens,
      totalOutputTokens:
        (this.conversationState?.totalOutputTokens ?? 0) +
        result.totalOutputTokens,
    };
    return allMessages;
  }

  private buildGeminiBuiltInTools(
    body: AgentRunRequest
  ): Record<string, unknown>[] {
    const tools: Record<string, unknown>[] = [];
    if (body.googleSearch) {
      tools.push({ googleSearch: {} });
    }
    return tools;
  }

  private buildLlmCallbacks(body: AgentRunRequest): {
    callLLM: (
      messages: AgentMessage[],
      tools: ToolDefinition[]
    ) => Promise<LLMResponse>;
    callFinalLLM?: (
      messages: AgentMessage[],
      tools: ToolDefinition[]
    ) => Promise<LLMResponse>;
  } {
    const builtInTools = this.buildGeminiBuiltInTools(body);
    const jsonSchema = toJsonSchema(body.schema);
    const llm = (
      messages: AgentMessage[],
      tools: ToolDefinition[],
      schema?: Record<string, unknown>
    ) =>
      callAgentLLM(this.env, {
        provider: body.provider,
        model: body.model,
        instructions: body.instructions,
        messages,
        tools,
        builtInTools,
        schema,
      });
    return {
      callLLM: (messages, tools) => llm(messages, tools),
      callFinalLLM: jsonSchema
        ? (messages, tools) => llm(messages, tools, jsonSchema)
        : undefined,
    };
  }
}

class NodeAgentRunnerHub {
  private readonly instances = new Map<string, NodeAgentRunnerInstance>();

  get(name: string): NodeAgentRunnerInstance {
    const existing = this.instances.get(name);
    if (existing) {
      return existing;
    }
    const instance = new NodeAgentRunnerInstance(getNodeBindings());
    this.instances.set(name, instance);
    return instance;
  }
}

const nodeAgentRunnerHub = new NodeAgentRunnerHub();

export function createNodeAgentRunnerNamespace(): DurableObjectNamespace {
  return {
    idFromName: (name: string) =>
      ({ toString: () => name }) as DurableObjectId,
    idFromString: (id: string) => ({ toString: () => id }) as DurableObjectId,
    newUniqueId: () =>
      ({ toString: () => crypto.randomUUID() }) as DurableObjectId,
    get: (id: DurableObjectId) => {
      const name = id.toString();
      const instance = nodeAgentRunnerHub.get(name);
      return {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const request =
            input instanceof Request ? input : new Request(input, init);
          return instance.fetch(request);
        },
      } as DurableObjectStub;
    },
  } as DurableObjectNamespace;
}
