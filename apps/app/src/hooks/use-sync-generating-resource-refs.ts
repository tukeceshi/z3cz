import {
  hasGeneratingResource,
  isGeneratingResourceRef,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { useEffect, useMemo, useRef } from "react";

import { resolveMediaResourceEntry } from "@/services/resolve-media-resource-fetch-url";
import { getCanvasMaintenanceFrozen } from "@/lib/canvas-maintenance-freeze";

import {
  withAiAudioGeneratingFlag,
  withAiAudioResourceGeneratingCleared,
  withAiAudioResourcesMarkedFailed,
} from "@/components/workflow/ai-audio-node-utils";
import {
  withAiImageGeneratingFlag,
  withAiImageResourceGeneratingCleared,
  withAiImageResourcesMarkedFailed,
} from "@/components/workflow/ai-image-node-utils";
import {
  withAiVideoGeneratingFlag,
  withAiVideoResourceGeneratingCleared,
  withAiVideoResourcesMarkedFailed,
} from "@/components/workflow/ai-video-node-utils";
import { clearGenerativeProgress } from "@/components/workflow/generative-progress-utils";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

const POLL_INTERVAL_MS = VIDEO_JOB_CLIENT_POLL_INTERVAL_MS;

export type GenerativeResourceSyncModality = "image" | "video" | "audio";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function applyGeneratingResourceSync(
  node: WorkflowNodeType,
  modality: GenerativeResourceSyncModality,
  resourceIds: readonly string[],
  failedIds: readonly string[]
): Partial<WorkflowNodeType> {
  if (failedIds.length > 0) {
    const withFailed =
      modality === "image"
        ? withAiImageResourcesMarkedFailed(node, failedIds)
        : modality === "video"
          ? withAiVideoResourcesMarkedFailed(node, failedIds)
          : withAiAudioResourcesMarkedFailed(node, failedIds);
    const cleared = clearGenerativeProgress(withFailed.metadata ?? node.metadata);
    const metadata =
      modality === "image"
        ? withAiImageGeneratingFlag(cleared, false)
        : modality === "video"
          ? withAiVideoGeneratingFlag(cleared, false)
          : withAiAudioGeneratingFlag(cleared, false);
    return { ...withFailed, metadata };
  }

  if (modality === "image") {
    return withAiImageResourceGeneratingCleared(node, resourceIds);
  }
  if (modality === "video") {
    return withAiVideoResourceGeneratingCleared(node, resourceIds);
  }
  return withAiAudioResourceGeneratingCleared(node, resourceIds);
}

export function useSyncGeneratingResourceRefs(params: {
  readonly orgId: string | undefined;
  readonly nodeId: string;
  readonly modality: GenerativeResourceSyncModality;
  readonly media: readonly WorkflowMediaValue[];
  readonly enabled: boolean;
  /** Keep generating cover until download/upload can actually show. */
  readonly holdClear?: boolean;
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: WorkflowNodeType) => Partial<WorkflowNodeType>
  ) => void;
}): void {
  const mediaRef = useRef(params.media);
  mediaRef.current = params.media;
  const holdClearRef = useRef(params.holdClear === true);
  holdClearRef.current = params.holdClear === true;
  const generatingKey = useMemo(
    () =>
      params.media
        .filter(isGeneratingResourceRef)
        .map((item) => item.resourceId)
        .join(","),
    [params.media]
  );

  useEffect(() => {
    if (!params.enabled || !params.orgId || !params.updateNodeData) {
      return;
    }
    if (!generatingKey || !hasGeneratingResource(params.media)) {
      return;
    }

    let cancelled = false;
    const organizationId = params.orgId;
    const updateNodeData = params.updateNodeData;
    const nodeId = params.nodeId;
    const modality = params.modality;

    const run = async (): Promise<void> => {
      while (!cancelled) {
        if (getCanvasMaintenanceFrozen()) {
          return;
        }
        const current = mediaRef.current;
        const generatingIds = current
          .filter(isGeneratingResourceRef)
          .map((item) => item.resourceId);
        if (generatingIds.length === 0) {
          return;
        }

        const entries = await Promise.all(
          generatingIds.map((resourceId) =>
            resolveMediaResourceEntry({ organizationId, resourceId })
          )
        );
        if (cancelled) {
          return;
        }

        const failedIds = generatingIds.filter((_, index) => {
          const entry = entries[index];
          return entry?.failed === true;
        });
        if (failedIds.length > 0) {
          if (getCanvasMaintenanceFrozen()) {
            return;
          }
          updateNodeData(nodeId, (node) =>
            applyGeneratingResourceSync(node, modality, generatingIds, failedIds)
          );
          return;
        }

        const stillGenerating = entries.some(
          (entry) => entry?.generating === true
        );
        const resolveFailed = entries.every((entry) => entry == null);
        if (stillGenerating || resolveFailed || holdClearRef.current) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }

        if (getCanvasMaintenanceFrozen()) {
          return;
        }

        updateNodeData(nodeId, (node) =>
          applyGeneratingResourceSync(node, modality, generatingIds, [])
        );
        return;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    generatingKey,
    params.enabled,
    params.modality,
    params.nodeId,
    params.orgId,
    params.updateNodeData,
  ]);
}
