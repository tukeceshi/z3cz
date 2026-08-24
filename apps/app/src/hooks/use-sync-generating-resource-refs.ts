import {
  isGeneratingResourceRef,
  isResourceIdReference,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
  type MediaResourceKind,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { useEffect, useMemo, useRef } from "react";

import { resolveMediaResourceEntry } from "@/services/resolve-media-resource-fetch-url";
import { getCanvasMaintenanceFrozen } from "@/lib/canvas-maintenance-freeze";

import {
  withAiAudioGeneratingFlag,
  withAiAudioResourceGeneratingCleared,
  withAiAudioResourceKinds,
  withAiAudioResourcesMarkedFailed,
} from "@/components/workflow/ai-audio-node-utils";
import {
  withAiImageGeneratingFlag,
  withAiImageResourceGeneratingCleared,
  withAiImageResourceKinds,
  withAiImageResourcesMarkedFailed,
} from "@/components/workflow/ai-image-node-utils";
import {
  withAiVideoGeneratingFlag,
  withAiVideoResourceGeneratingCleared,
  withAiVideoResourceKinds,
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

function applyResourceKinds(
  node: WorkflowNodeType,
  modality: GenerativeResourceSyncModality,
  kindsById: ReadonlyMap<string, MediaResourceKind>
): Partial<WorkflowNodeType> {
  if (kindsById.size === 0) {
    return {};
  }
  if (modality === "image") {
    return withAiImageResourceKinds(node, kindsById);
  }
  if (modality === "video") {
    return withAiVideoResourceKinds(node, kindsById);
  }
  return withAiAudioResourceKinds(node, kindsById);
}

function collectResourceIds(
  media: readonly WorkflowMediaValue[]
): readonly string[] {
  return [
    ...new Set(
      media
        .filter(isResourceIdReference)
        .map((item) => item.resourceId)
        .filter((id) => id.length > 0)
    ),
  ];
}

function collectKindMismatches(
  media: readonly WorkflowMediaValue[],
  entriesById: ReadonlyMap<
    string,
    { readonly kind?: MediaResourceKind } | null | undefined
  >
): Map<string, MediaResourceKind> {
  const kindsById = new Map<string, MediaResourceKind>();
  for (const item of media) {
    if (!isResourceIdReference(item)) {
      continue;
    }
    const entry = entriesById.get(item.resourceId);
    if (!entry?.kind || entry.kind === item.kind) {
      continue;
    }
    kindsById.set(item.resourceId, entry.kind);
  }
  return kindsById;
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
  const resourceKindKey = useMemo(
    () =>
      params.media
        .filter(isResourceIdReference)
        .map((item) => `${item.resourceId}:${item.kind ?? ""}`)
        .join(","),
    [params.media]
  );

  useEffect(() => {
    if (!params.enabled || !params.orgId || !params.updateNodeData) {
      return;
    }
    if (!generatingKey && !resourceKindKey) {
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
        const allIds = collectResourceIds(current);
        const generatingIds = current
          .filter(isGeneratingResourceRef)
          .map((item) => item.resourceId);
        if (allIds.length === 0) {
          return;
        }

        const entries = await Promise.all(
          allIds.map((resourceId) =>
            resolveMediaResourceEntry({ organizationId, resourceId })
          )
        );
        if (cancelled) {
          return;
        }

        const entriesById = new Map(
          allIds.map((resourceId, index) => [resourceId, entries[index]])
        );
        const kindsById = collectKindMismatches(current, entriesById);

        const failedIds = generatingIds.filter((resourceId) => {
          const entry = entriesById.get(resourceId);
          return entry?.failed === true;
        });
        if (failedIds.length > 0) {
          if (getCanvasMaintenanceFrozen()) {
            return;
          }
          updateNodeData(nodeId, (node) => {
            const synced = applyGeneratingResourceSync(
              node,
              modality,
              generatingIds,
              failedIds
            );
            const kindPatch = applyResourceKinds(
              { ...node, ...synced },
              modality,
              kindsById
            );
            return { ...synced, ...kindPatch };
          });
          return;
        }

        const stillGenerating = generatingIds.some((resourceId) => {
          const entry = entriesById.get(resourceId);
          return entry?.generating === true;
        });
        const resolveFailed =
          generatingIds.length > 0 &&
          generatingIds.every((resourceId) => entriesById.get(resourceId) == null);
        const generatingDone =
          generatingIds.length > 0 &&
          !stillGenerating &&
          !resolveFailed &&
          !holdClearRef.current;
        const shouldPoll =
          generatingIds.length > 0 &&
          (stillGenerating || resolveFailed || holdClearRef.current);

        if (generatingDone || kindsById.size > 0) {
          if (getCanvasMaintenanceFrozen()) {
            return;
          }
          updateNodeData(nodeId, (node) => {
            const synced = generatingDone
              ? applyGeneratingResourceSync(node, modality, generatingIds, [])
              : {};
            const kindPatch = applyResourceKinds(
              { ...node, ...synced },
              modality,
              kindsById
            );
            return { ...synced, ...kindPatch };
          });
          if (!shouldPoll) {
            return;
          }
        }

        if (!shouldPoll) {
          return;
        }

        await sleep(POLL_INTERVAL_MS);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    generatingKey,
    resourceKindKey,
    params.enabled,
    params.modality,
    params.nodeId,
    params.orgId,
    params.updateNodeData,
  ]);
}
