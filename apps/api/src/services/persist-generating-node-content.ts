import type {
  AppendAudioGeneratingContentParams,
  AppendImageGeneratingContentParams,
  AppendMediaGeneratingContentParams,
  AppendTextGeneratingContentParams,
  GenerationJobModality,
  MediaReference,
  MediaResourceKind,
  WorkflowNodeContentPatch,
} from "@dafthunk/types";
import {
  appendAudioGeneratingContent,
  appendImageGeneratingContent,
  appendTextGeneratingContent,
  appendVideoGeneratingContent,
  buildWorkflowNodeContentPatch,
  finalizeImageGeneratingContent,
  finalizeVideoGeneratingContent,
  mediaReferenceToWorkflowValue,
  patchNodeMediaCloudAccelerationStatus,
  patchNodeMediaCancellingStatus,
  patchNodeMediaResourceKinds,
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

export function cloudKindsByResourceIds(
  ids: readonly (string | undefined | null)[]
): Map<string, MediaResourceKind> {
  const map = new Map<string, MediaResourceKind>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (id) {
      map.set(id, "cloud");
    }
  }
  return map;
}

/** Server persist finished — write `kind` onto the node JSON media refs. */
export async function persistJobCloudMediaKinds(
  env: Bindings,
  job: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly resultJson?: {
      readonly placeholderResourceIds?: readonly string[] | null;
    } | null;
  },
  pendingMedia: readonly { readonly resourceId?: string | null }[]
): Promise<WorkflowNodeContentPatch | null> {
  return persistWorkflowMediaResourceKinds(env, {
    organizationId: job.organizationId,
    workflowId: job.workflowId,
    nodeId: job.nodeId,
    kindsById: cloudKindsByResourceIds([
      ...pendingMedia.map((item) => item.resourceId),
      ...(job.resultJson?.placeholderResourceIds ?? []),
    ]),
  });
}

/** Job succeeded — replace generating history rows with final cloud media. */
export async function persistJobFinalizedGeneratingContent(
  env: Bindings,
  job: {
    readonly id: string;
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly modality: GenerationJobModality;
    readonly resultJson?: {
      readonly placeholderResourceIds?: readonly string[] | null;
    } | null;
  },
  pendingMedia: readonly { readonly resourceId?: string | null }[],
  finalMedia: readonly MediaReference[]
): Promise<WorkflowNodeContentPatch | null> {
  if (finalMedia.length === 0) {
    return persistJobCloudMediaKinds(env, job, pendingMedia);
  }

  const workflowId = job.workflowId?.trim();
  const nodeId = job.nodeId?.trim();
  if (!workflowId || !nodeId) {
    return null;
  }

  const workflowStore = new WorkflowStore(env);
  const workflowWithData = await workflowStore.getWithData(
    workflowId,
    job.organizationId
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
  const media = finalMedia.map((reference) =>
    mediaReferenceToWorkflowValue(reference)
  );
  const resourceIds = [
    ...pendingMedia.map((item) => item.resourceId),
    ...(job.resultJson?.placeholderResourceIds ?? []),
  ].filter((id): id is string => Boolean(id?.trim()));

  const contentPatch =
    job.modality === "image"
      ? finalizeImageGeneratingContent(node, {
          jobId: job.id,
          resourceIds,
          media,
        })
      : job.modality === "video"
        ? finalizeVideoGeneratingContent(node, {
            jobId: job.id,
            resourceIds,
            media,
          })
        : patchNodeMediaResourceKinds(
            node,
            cloudKindsByResourceIds(resourceIds)
          );

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
    organizationId: job.organizationId,
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

export async function persistWorkflowMediaResourceKinds(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly kindsById: ReadonlyMap<string, MediaResourceKind>;
  }
): Promise<WorkflowNodeContentPatch | null> {
  const workflowId = params.workflowId?.trim();
  const nodeId = params.nodeId?.trim();
  if (!workflowId || !nodeId || params.kindsById.size === 0) {
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
  const contentPatch = patchNodeMediaResourceKinds(node, params.kindsById);
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

export async function persistWorkflowMediaCloudAccelerationStatus(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly resourceIds: readonly string[];
    readonly status: "pending" | "active";
  }
): Promise<WorkflowNodeContentPatch | null> {
  const workflowId = params.workflowId?.trim();
  const nodeId = params.nodeId?.trim();
  if (!workflowId || !nodeId || params.resourceIds.length === 0) {
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
  const contentPatch = patchNodeMediaCloudAccelerationStatus(node, {
    resourceIds: params.resourceIds,
    status: params.status,
  });
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

export async function persistWorkflowMediaCancellingStatus(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly resourceIds: readonly string[];
    readonly cancelling: boolean;
  }
): Promise<WorkflowNodeContentPatch | null> {
  const workflowId = params.workflowId?.trim();
  const nodeId = params.nodeId?.trim();
  if (!workflowId || !nodeId || params.resourceIds.length === 0) {
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
  const contentPatch = patchNodeMediaCancellingStatus(node, {
    resourceIds: params.resourceIds,
    cancelling: params.cancelling,
  });
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

export async function persistJobCancellingNodeContent(
  env: Bindings,
  job: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly resultJson?: {
      readonly placeholderResourceIds?: readonly string[] | null;
    } | null;
  },
  cancelling: boolean
): Promise<WorkflowNodeContentPatch | null> {
  const resourceIds = job.resultJson?.placeholderResourceIds ?? [];
  if (resourceIds.length === 0) {
    return null;
  }

  return persistWorkflowMediaCancellingStatus(env, {
    organizationId: job.organizationId,
    workflowId: job.workflowId,
    nodeId: job.nodeId,
    resourceIds,
    cancelling,
  });
}

export async function persistJobCloudAccelerationStatus(
  env: Bindings,
  job: {
    readonly organizationId: string;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly resultJson?: {
      readonly placeholderResourceIds?: readonly string[] | null;
    } | null;
  },
  pendingMedia: readonly { readonly resourceId?: string | null }[],
  status: "pending" | "active"
): Promise<WorkflowNodeContentPatch | null> {
  const resourceIds = [
    ...pendingMedia.map((item) => item.resourceId),
    ...(job.resultJson?.placeholderResourceIds ?? []),
  ].filter((id): id is string => Boolean(id?.trim()));

  return persistWorkflowMediaCloudAccelerationStatus(env, {
    organizationId: job.organizationId,
    workflowId: job.workflowId,
    nodeId: job.nodeId,
    resourceIds,
    status,
  });
}
