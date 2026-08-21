import type {
  AppendAudioGeneratingContentParams,
  AppendImageGeneratingContentParams,
  AppendMediaGeneratingContentParams,
  AppendTextGeneratingContentParams,
  WorkflowNodeContentPatch,
} from "@dafthunk/types";
import {
  appendAudioGeneratingContent,
  appendImageGeneratingContent,
  appendTextGeneratingContent,
  appendVideoGeneratingContent,
  buildWorkflowNodeContentPatch,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { nodeWorkflowSessionHub } from "../runtime/node-workflow-session-hub";
import type { SaveWorkflowRecord } from "../stores/workflow-store";
import { WorkflowStore } from "../stores/workflow-store";
import { registerGeneratingPlaceholderResources } from "./register-generating-placeholder-resources";

export type PersistGeneratingNodeContentParams =
  | {
      readonly modality: "image";
      readonly entry: AppendImageGeneratingContentParams;
    }
  | {
      readonly modality: "video";
      readonly entry: AppendMediaGeneratingContentParams;
    }
  | {
      readonly modality: "audio";
      readonly entry: AppendMediaGeneratingContentParams;
    }
  | {
      readonly modality: "text";
      readonly entry: AppendTextGeneratingContentParams;
    };

export async function persistGeneratingNodeContentToWorkflow(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
  } & PersistGeneratingNodeContentParams
): Promise<WorkflowNodeContentPatch | null> {
  const workflowId = params.workflowId?.trim();
  const nodeId = params.nodeId?.trim();
  if (!workflowId || !nodeId) {
    return null;
  }

  const workflowStore = new WorkflowStore(env);
  const workflowWithData = await workflowStore.getWithData(
    workflowId,
    params.organizationId
  );
  if (!workflowWithData) {
    return null;
  }

  const nodeIndex = workflowWithData.data.nodes.findIndex(
    (node) => node.id === nodeId
  );
  if (nodeIndex < 0) {
    return null;
  }

  const node = workflowWithData.data.nodes[nodeIndex]!;
  const contentPatch =
    params.modality === "image"
      ? appendImageGeneratingContent(node, params.entry)
      : params.modality === "video"
        ? appendVideoGeneratingContent(node, params.entry)
        : params.modality === "audio"
          ? appendAudioGeneratingContent(node, params.entry)
          : appendTextGeneratingContent(node, params.entry);

  if (!contentPatch) {
    return null;
  }

  const updatedNode = { ...node, ...contentPatch };
  const nodes = [...workflowWithData.data.nodes];
  nodes[nodeIndex] = updatedNode;

  const workflowRecord: SaveWorkflowRecord = {
    id: workflowWithData.id,
    name: workflowWithData.name,
    description: workflowWithData.description ?? undefined,
    schemeId: workflowWithData.schemeId,
    trigger: workflowWithData.trigger,
    runtime: workflowWithData.runtime,
    organizationId: params.organizationId,
    folderId: workflowWithData.folderId,
    coverObjectId: workflowWithData.coverObjectId,
    coverMimeType: workflowWithData.coverMimeType,
    nodes,
    edges: workflowWithData.data.edges,
    editorViewport: workflowWithData.data.editorViewport,
    generativeDefaults: workflowWithData.data.generativeDefaults,
    createdAt: workflowWithData.createdAt,
    updatedAt: new Date(),
  };

  await workflowStore.save(workflowRecord);

  const patch = buildWorkflowNodeContentPatch(node, updatedNode);
  if (patch) {
    await nodeWorkflowSessionHub.broadcastServerNodeUpdate(
      env,
      workflowId,
      updatedNode
    );
  }

  return patch;
}

export async function persistTextGeneratingPlaceholder(
  env: Bindings,
  db: Database,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly invocationId: string;
    readonly platformModelId: string;
    readonly aiInterfaceId: string;
    readonly modelDisplayName: string;
  }
): Promise<{
  readonly resourceId: string;
  readonly workflowNodeContent: WorkflowNodeContentPatch | null;
}> {
  const [resourceId] = await registerGeneratingPlaceholderResources(db, {
    organizationId: params.organizationId,
    mimeType: "text/plain",
  });
  const workflowNodeContent = await persistGeneratingNodeContentToWorkflow(
    env,
    {
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      nodeId: params.nodeId,
      modality: "text",
      entry: {
        invocationId: params.invocationId,
        resourceId: resourceId!,
        platformModelId: params.platformModelId,
        aiInterfaceId: params.aiInterfaceId,
        modelDisplayName: params.modelDisplayName,
      },
    }
  );
  return { resourceId: resourceId!, workflowNodeContent };
}
