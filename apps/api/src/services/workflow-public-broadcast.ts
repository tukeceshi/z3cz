import type { WorkflowPublicMessage, WorkflowPublicState } from "@dafthunk/types";

import type { Bindings } from "../context";
import { getAgentByName } from "../durable-objects/agent-utils";
import { nodeWorkflowSessionHub } from "../runtime/node-workflow-session-hub";
import { setWorkflowPublicState } from "../runtime/platform-public-state";

const ACTIVE_EDITOR_WORKFLOWS_KV_KEY = "platform:active-editor-workflows";

function createWorkflowPublicMessage(
  state: WorkflowPublicState
): WorkflowPublicMessage {
  return {
    type: "public",
    public: state,
  };
}

export async function registerActiveEditorWorkflow(
  env: Bindings,
  workflowId: string
): Promise<void> {
  if (!workflowId || env.RUNTIME === "node") {
    return;
  }

  const existing =
    (await env.KV.get(ACTIVE_EDITOR_WORKFLOWS_KV_KEY, "json")) as
      | string[]
      | null;
  const ids = new Set(existing ?? []);
  ids.add(workflowId);
  await env.KV.put(ACTIVE_EDITOR_WORKFLOWS_KV_KEY, JSON.stringify([...ids]));
}

export async function unregisterActiveEditorWorkflow(
  env: Bindings,
  workflowId: string
): Promise<void> {
  if (!workflowId || env.RUNTIME === "node") {
    return;
  }

  const existing =
    (await env.KV.get(ACTIVE_EDITOR_WORKFLOWS_KV_KEY, "json")) as
      | string[]
      | null;
  if (!existing?.length) {
    return;
  }

  const ids = existing.filter((id) => id !== workflowId);
  await env.KV.put(ACTIVE_EDITOR_WORKFLOWS_KV_KEY, JSON.stringify(ids));
}

export async function broadcastWorkflowPublicState(
  env: Bindings,
  state: WorkflowPublicState
): Promise<void> {
  setWorkflowPublicState(state);
  const payload = JSON.stringify(createWorkflowPublicMessage(state));

  if (env.RUNTIME === "node") {
    nodeWorkflowSessionHub.broadcastPublicState(state);
    return;
  }

  const activeIds =
    ((await env.KV.get(ACTIVE_EDITOR_WORKFLOWS_KV_KEY, "json")) as
      | string[]
      | null) ?? [];

  await Promise.all(
    activeIds.map(async (workflowId) => {
      try {
        const stub = await getAgentByName(env.WORKFLOW_AGENT, workflowId);
        await stub.fetch(
          new Request("https://workflow-agent/internal/broadcast-public", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          })
        );
      } catch (error) {
        console.error(
          `[WorkflowPublicBroadcast] Failed for workflow ${workflowId}:`,
          error
        );
      }
    })
  );
}
