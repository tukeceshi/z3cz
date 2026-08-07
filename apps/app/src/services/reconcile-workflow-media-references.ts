import {
  getMediaReferenceKey,
  isLocalMediaReference,
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { rebuildMediaResourceAliasesFromCache } from "@/services/ai-media-cache-service";
import {
  objectReferenceFromStorageKey,
  recordMediaResourceAlias,
  resolveMediaResourceAlias,
} from "@/services/media-resource-alias-service";
import {
  rekeyMediaReferencesInNodeData,
  rekeyMediaReferencesInNodes,
} from "@/services/rekey-workflow-media-references";

const HISTORY_INPUTS = [
  { id: "images_history", field: "images" },
  { id: "videos_history", field: "videos" },
  { id: "audios_history", field: "audios" },
] as const;

const MEDIA_ARRAY_INPUTS = new Set([
  "manual_images",
  "images_result",
  "videos_result",
  "audios_result",
  "reference_images",
  "reference_videos",
  "reference_audios",
]);

function collectLocalMediaReferences(
  data: WorkflowNodeType
): readonly MediaReference[] {
  const refs: MediaReference[] = [];

  for (const input of data.inputs) {
    if (MEDIA_ARRAY_INPUTS.has(input.id) && Array.isArray(input.value)) {
      for (const item of input.value) {
        if (isMediaReference(item) && isLocalMediaReference(item)) {
          refs.push(item);
        }
      }
    }

    for (const history of HISTORY_INPUTS) {
      if (input.id !== history.id || !input.value || typeof input.value !== "object") {
        continue;
      }
      const items = (input.value as { readonly items?: readonly unknown[] }).items;
      if (!Array.isArray(items)) continue;
      for (const entry of items) {
        if (!entry || typeof entry !== "object") continue;
        const media = (entry as Record<string, unknown>)[history.field];
        if (!Array.isArray(media)) continue;
        for (const item of media) {
          if (isMediaReference(item) && isLocalMediaReference(item)) {
            refs.push(item);
          }
        }
      }
    }
  }

  for (const output of data.outputs) {
    if (output.id !== "output" || !Array.isArray(output.value)) continue;
    for (const item of output.value) {
      if (isMediaReference(item) && isLocalMediaReference(item)) {
        refs.push(item);
      }
    }
  }

  return refs;
}

function inferNodeTypeFromMime(
  mimeType: string
): "ai-image" | "ai-video" | "ai-audio" {
  if (mimeType.startsWith("video/")) return "ai-video";
  if (mimeType.startsWith("audio/")) return "ai-audio";
  return "ai-image";
}

function collectAllLocalHints(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[]
): readonly {
  readonly mediaId: string;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}[] {
  const hints = new Map<
    string,
    {
      readonly mediaId: string;
      readonly mimeType: string;
      readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
    }
  >();
  for (const node of nodes) {
    for (const ref of collectLocalMediaReferences(node.data)) {
      hints.set(ref.mediaId, {
        mediaId: ref.mediaId,
        mimeType: ref.mimeType,
        nodeType: inferNodeTypeFromMime(ref.mimeType),
      });
    }
  }
  return [...hints.values()];
}

async function upgradeLocalReference(params: {
  readonly media: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<MediaReference | null> {
  if (!isLocalMediaReference(params.media)) {
    return null;
  }

  const alias = resolveMediaResourceAlias({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    fromMediaId: params.media.mediaId,
  });

  if (!alias) {
    return null;
  }

  return objectReferenceFromStorageKey({
    storageKey: alias,
    mimeType: params.media.mimeType,
  });
}

export async function reconcileWorkflowMediaReferencesInNodes(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[],
  organizationId: string,
  workflowId: string
): Promise<ReactFlowNode<WorkflowNodeType>[] | null> {
  if (!organizationId || !workflowId || nodes.length === 0) {
    return null;
  }

  const localHints = collectAllLocalHints(nodes);
  await rebuildMediaResourceAliasesFromCache({
    organizationId,
    workflowId,
    localHints,
  });

  let nextNodes = nodes;
  let changed = false;

  for (const node of nodes) {
    const localRefs = collectLocalMediaReferences(node.data);
    for (const localRef of localRefs) {
      const upgraded = await upgradeLocalReference({
        media: localRef,
        organizationId,
        workflowId,
      });
      if (!upgraded) continue;

      recordMediaResourceAlias({
        organizationId,
        workflowId,
        fromMediaId: localRef.mediaId,
        toMediaId: getMediaReferenceKey(upgraded),
      });

      const patched = rekeyMediaReferencesInNodeData(
        nextNodes.find((entry) => entry.id === node.id)?.data ?? node.data,
        localRef.mediaId,
        upgraded
      );
      if (!patched) continue;

      changed = true;
      nextNodes = nextNodes.map((entry) =>
        entry.id === node.id ? { ...entry, data: patched } : entry
      );
    }
  }

  return changed ? nextNodes : null;
}

export function applyMediaResourceRekeyToNodes(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[],
  fromMediaId: string,
  toMediaReference: MediaReference
): ReactFlowNode<WorkflowNodeType>[] | null {
  return rekeyMediaReferencesInNodes(nodes, fromMediaId, toMediaReference);
}
