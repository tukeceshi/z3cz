import {
  isAiVideoRetakePanel,
  readAiVideoRetakeDraftFromInputs,
} from "@dafthunk/types";
import { useNodes } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useAppToast } from "@/hooks/use-app-toast";

import { withAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import { resolveRetakePrimaryVideoRef } from "./ai-video-retake-primary-ref";
import { useOptionalRetakePlaybackUrlContext } from "./retake-playback-url-context";
import {
  buildRetakePrimaryVideoMediaKey,
  syncRetakePrimaryVideoDraft,
} from "./sync-retake-primary-video";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

function retakeDraftPatchEquals(
  current: ReturnType<typeof readAiVideoRetakeDraftFromInputs>,
  patch: Partial<ReturnType<typeof readAiVideoRetakeDraftFromInputs>>
): boolean {
  return (Object.keys(patch) as (keyof typeof patch)[]).every((key) => {
    const nextValue = patch[key];
    if (nextValue === undefined) {
      return true;
    }
    const currentValue = current[key];
    if (
      typeof nextValue === "object" &&
      nextValue !== null &&
      typeof currentValue === "object" &&
      currentValue !== null
    ) {
      return JSON.stringify(nextValue) === JSON.stringify(currentValue);
    }
    return nextValue === currentValue;
  });
}

export function useRetakePrimaryVideoSync(
  nodeId: string,
  data: WorkflowNodeType
): void {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { edges = [], updateNodeData, disabled } = useWorkflow();
  const flowNodes = useNodes();
  const toast = useAppToast();
  const prevMediaKeyRef = useRef<string | null>(null);
  const playbackUrlContext = useOptionalRetakePlaybackUrlContext();

  const isRetakePanel = isAiVideoRetakePanel(data.metadata);
  const primaryVideoEdgeId = useMemo(
    () => readAiVideoRetakeDraftFromInputs(data.inputs).primaryVideoEdgeId,
    [data.inputs]
  );

  const typedNodes = useMemo(
    () =>
      flowNodes.map((node) => ({
        id: node.id,
        data: node.data as WorkflowNodeType,
      })),
    [flowNodes]
  );

  const syncTriggerKey = useMemo(() => {
    if (!isRetakePanel) {
      return null;
    }
    const primary = resolveRetakePrimaryVideoRef({
      targetNodeId: nodeId,
      edges,
      nodes: typedNodes,
      inputs: data.inputs,
      draft: { primaryVideoEdgeId } as ReturnType<
        typeof readAiVideoRetakeDraftFromInputs
      >,
    });
    if (!primary) {
      return "none";
    }
    return buildRetakePrimaryVideoMediaKey({
      edgeId: primary.edgeId,
      media: primary.media,
    });
  }, [data.inputs, edges, isRetakePanel, nodeId, primaryVideoEdgeId, typedNodes]);

  useEffect(() => {
    if (
      !isRetakePanel ||
      syncTriggerKey === null ||
      disabled ||
      !updateNodeData ||
      !orgId ||
      !workflowId
    ) {
      return;
    }

    let cancelled = false;
    const currentInputs = data.inputs;
    const currentEdges = edges;
    const currentNodes = typedNodes;

    void (async () => {
      const currentDraft = readAiVideoRetakeDraftFromInputs(currentInputs);
      const { patch, playbackUrl } = await syncRetakePrimaryVideoDraft({
        targetNodeId: nodeId,
        edges: currentEdges,
        nodes: currentNodes,
        inputs: currentInputs,
        organizationId: orgId,
        workflowId,
        currentDraft,
      });

      if (cancelled) {
        return;
      }

      playbackUrlContext?.setPlaybackUrl(
        nodeId,
        playbackUrl,
        patch.primaryVideoMediaKey ?? null
      );

      if (Object.keys(patch).length === 0) {
        return;
      }

      if (retakeDraftPatchEquals(currentDraft, patch)) {
        return;
      }

      updateNodeData(nodeId, (current) => withAiVideoRetakeDraft(current, patch));

      const nextMediaKey = patch.primaryVideoMediaKey ?? syncTriggerKey;
      const prevKey = prevMediaKeyRef.current;
      if (
        prevKey &&
        prevKey !== "none" &&
        prevKey !== nextMediaKey &&
        patch.loadPhase === "ready"
      ) {
        toast.info("workflow.videoRetake.sourceResynced");
      }
      prevMediaKeyRef.current = nextMediaKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    disabled,
    isRetakePanel,
    nodeId,
    orgId,
    playbackUrlContext,
    syncTriggerKey,
    toast,
    updateNodeData,
    workflowId,
  ]);

  useEffect(() => {
    if (syncTriggerKey && prevMediaKeyRef.current === null) {
      prevMediaKeyRef.current =
        readAiVideoRetakeDraftFromInputs(data.inputs).primaryVideoMediaKey ??
        syncTriggerKey;
    }
  }, [data.inputs, syncTriggerKey]);
}
