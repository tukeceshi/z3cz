import type { Node } from "@dafthunk/types";

import { applyNodeResult } from "../execution-state";
import type {
  NodeExecutionResult,
  NodeRuntimeValues,
  WorkflowExecutionContext,
} from "../execution-types";
import type { NodeEnv } from "../node-types";
import type { ObjectStore } from "../object-store";
import { pollUpstreamContinuation } from "../upstream/upstream-poll-router";
import type { UpstreamPollResult } from "../upstream/upstream-types";
import { reschedulePollContinuation, resolvePollTimeout } from "../upstream/upstream-types";
import { nodeToApiParameter } from "../parameter-mapper";
import {
  registerContinuation,
  removeContinuation,
  type HeartbeatState,
} from "./continuation-store";

export interface PollContinuationHandlerDeps {
  readonly objectStore: ObjectStore;
  readonly env: NodeEnv;
  readonly relayAccountService?: import("../relay-account-service").RelayAccountService;
  readonly findNode: (workflowContext: WorkflowExecutionContext, nodeId: string) => Node | undefined;
}

export interface PollContinuationHandler {
  pollDue(
    workflowContext: WorkflowExecutionContext,
    state: HeartbeatState,
    now: Date
  ): Promise<HeartbeatState>;
}

function applyNodeExecutionToHeartbeat(
  heartbeatState: HeartbeatState,
  result: NodeExecutionResult
): HeartbeatState {
  if (result.status === "pending") {
    let next = heartbeatState;
    if (result.continuation) {
      next = registerContinuation(next, result.continuation);
    }
    return next;
  }

  applyNodeResult(heartbeatState.execution, result);
  const settled = new Set(heartbeatState.settled);
  settled.add(result.nodeId);
  return removeContinuation({ ...heartbeatState, settled }, result.nodeId);
}

async function upstreamResultToNodeExecution(
  nodeId: string,
  pollResult: UpstreamPollResult,
  workflowContext: WorkflowExecutionContext,
  objectStore: ObjectStore
): Promise<NodeExecutionResult> {
  if (pollResult.status === "pending") {
    return {
      nodeId,
      status: "pending",
      eventType: "upstream_poll",
      timeout: "30 minutes",
    };
  }

  if (pollResult.status === "failed") {
    return {
      nodeId,
      status: "error",
      error: pollResult.error,
      usage: pollResult.usage ?? 0,
    };
  }

  const node = workflowContext.workflow.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    return {
      nodeId,
      status: "error",
      error: `Node ${nodeId} not found in workflow`,
    };
  }

  const outputsForRuntime: NodeRuntimeValues = {};
  for (const [name, value] of Object.entries(pollResult.outputs)) {
    const output = node.outputs.find((entry) => entry.name === name);
    const parameterType = output?.type ?? "string";

    if (output?.repeated && Array.isArray(value)) {
      outputsForRuntime[name] = await Promise.all(
        value.map((item) =>
          nodeToApiParameter(
            parameterType,
            item,
            objectStore,
            workflowContext.organizationId,
            workflowContext.executionId
          )
        )
      );
    } else {
      outputsForRuntime[name] = await nodeToApiParameter(
        parameterType,
        value,
        objectStore,
        workflowContext.organizationId,
        workflowContext.executionId
      );
    }
  }

  return {
    nodeId,
    status: "completed",
    outputs: outputsForRuntime,
    usage: pollResult.usage,
  };
}

export function createPollContinuationHandler(
  deps: PollContinuationHandlerDeps
): PollContinuationHandler {
  return {
    async pollDue(workflowContext, state, now): Promise<HeartbeatState> {
      let next = state;

      for (const continuation of listDuePollContinuations(next, now)) {
        const timedOut = resolvePollTimeout(continuation, now);
        if (timedOut) {
          next = applyNodeExecutionToHeartbeat(
            next,
            await upstreamResultToNodeExecution(
              continuation.nodeId,
              timedOut,
              workflowContext,
              deps.objectStore
            )
          );
          continue;
        }

        const node = deps.findNode(workflowContext, continuation.nodeId);
        if (!node) {
          next = applyNodeExecutionToHeartbeat(next, {
            nodeId: continuation.nodeId,
            status: "error",
            error: `Node ${continuation.nodeId} not found in workflow`,
          });
          continue;
        }

        const pollResult = await pollUpstreamContinuation({
          continuation,
          objectStore: deps.objectStore,
          organizationId: workflowContext.organizationId,
          executionId: workflowContext.executionId,
          env: deps.env,
          relayAccountService: deps.relayAccountService,
          nodeOutputs: node.outputs,
        });

        if (pollResult.status === "pending") {
          next = registerContinuation(
            next,
            reschedulePollContinuation(
              continuation,
              new Date(pollResult.nextPollAt)
            )
          );
          continue;
        }

        next = applyNodeExecutionToHeartbeat(
          next,
          await upstreamResultToNodeExecution(
            continuation.nodeId,
            pollResult,
            workflowContext,
            deps.objectStore
          )
        );
      }

      return next;
    },
  };
}

export const noopPollContinuationHandler: PollContinuationHandler = {
  async pollDue(_workflowContext, state): Promise<HeartbeatState> {
    return state;
  },
};

export function listDuePollContinuations(
  state: HeartbeatState,
  now: Date
): import("@dafthunk/types").UpstreamPollContinuation[] {
  const nowMs = now.getTime();
  return [...state.continuations.values()].filter(
    (continuation): continuation is import("@dafthunk/types").UpstreamPollContinuation =>
      continuation.kind === "upstream_poll" &&
      Date.parse(continuation.nextPollAt) <= nowMs
  );
}
