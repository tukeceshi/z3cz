import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getResourceIdFromValue,
  isResourceIdReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useNodes } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { readAiAudioCardAudios } from "@/components/workflow/ai-audio-node-utils";
import { readAiImageCardPrimaryImage } from "@/components/workflow/ai-image-node-utils";
import { isAiTextGenerating } from "@/components/workflow/ai-text-node-utils";
import { readAiTextResultReference } from "@/components/workflow/ai-text-persist-utils";
import { readAiVideoCardPrimaryVideo } from "@/components/workflow/ai-video-node-utils";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import { pushAiTextCacheToDisplay } from "@/services/push-ai-text-cache-to-node";

function hydrateFingerprint(
  node: Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">
): string | null {
  const nodeType = node.data.nodeType ?? "";

  if (nodeType === AI_TEXT_NODE_TYPE) {
    if (isAiTextGenerating(node.data.metadata)) {
      return null;
    }
    const reference = readAiTextResultReference(node.data.inputs);
    if (!reference) {
      return null;
    }
    const mediaId = getResourceIdFromValue(reference);
    if (!mediaId) {
      return null;
    }
    const sha = isResourceIdReference(reference)
      ? (reference.contentSha256 ?? "")
      : "";
    return `text:${mediaId}:${sha}`;
  }

  if (nodeType === AI_IMAGE_NODE_TYPE) {
    const media = readAiImageCardPrimaryImage(
      node.data.inputs,
      node.data.outputs,
      node.data.metadata
    );
    const resourceId = media ? getResourceIdFromValue(media) : null;
    return resourceId ? `media:${resourceId}` : null;
  }

  if (nodeType === AI_VIDEO_NODE_TYPE) {
    const media = readAiVideoCardPrimaryVideo(
      node.data.inputs,
      node.data.outputs,
      node.data.metadata
    );
    const resourceId = media ? getResourceIdFromValue(media) : null;
    return resourceId ? `media:${resourceId}` : null;
  }

  if (nodeType === AI_AUDIO_NODE_TYPE) {
    const media = readAiAudioCardAudios(
      node.data.inputs,
      node.data.outputs,
      node.data.metadata
    )[0];
    const resourceId = media ? getResourceIdFromValue(media) : null;
    return resourceId ? `media:${resourceId}` : null;
  }

  return null;
}

/** Node cards own cloud hydrate; edit panels read cache only. */
export function useGenerativeNodeCardHydrate(
  node: Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">
): void {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const hydratedRef = useRef<string | null>(null);
  const fingerprint = useMemo(() => hydrateFingerprint(node), [node]);

  useEffect(() => {
    if (!orgId || !workflowId || !fingerprint) {
      return;
    }
    if (hydratedRef.current === fingerprint) {
      return;
    }
    hydratedRef.current = fingerprint;

    const nodeType = node.data.nodeType ?? "";

    if (nodeType === AI_TEXT_NODE_TYPE) {
      const reference = readAiTextResultReference(node.data.inputs);
      if (!reference) {
        return;
      }
      void pushAiTextCacheToDisplay({
        organizationId: orgId,
        workflowId,
        reference,
        workflowSha: isResourceIdReference(reference)
          ? reference.contentSha256
          : undefined,
      }).catch(() => undefined);
      return;
    }

    let media = null as ReturnType<typeof readAiImageCardPrimaryImage> | undefined;
    let ingestNodeType: "ai-image" | "ai-video" | "ai-audio" | null = null;

    if (nodeType === AI_IMAGE_NODE_TYPE) {
      media = readAiImageCardPrimaryImage(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      );
      ingestNodeType = "ai-image";
    } else if (nodeType === AI_VIDEO_NODE_TYPE) {
      media = readAiVideoCardPrimaryVideo(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      );
      ingestNodeType = "ai-video";
    } else if (nodeType === AI_AUDIO_NODE_TYPE) {
      media = readAiAudioCardAudios(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      )[0];
      ingestNodeType = "ai-audio";
    }

    if (!media || !ingestNodeType) {
      return;
    }

    ingestCanvasMediaInBackground({
      organizationId: orgId,
      workflowId,
      media,
      nodeType: ingestNodeType,
    });
  }, [fingerprint, node.data, orgId, workflowId]);
}

/** Canvas widgets — resolve full node from React Flow store. */
export function useGenerativeNodeCardHydrateById(nodeId: string): void {
  const nodes = useNodes<WorkflowNodeType>();
  const node = useMemo(
    () => nodes.find((entry) => entry.id === nodeId) ?? null,
    [nodeId, nodes]
  );

  useGenerativeNodeCardHydrate(
    node ?? {
      id: nodeId,
      data: { inputs: [], outputs: [], metadata: {}, nodeType: "" },
    }
  );
}
