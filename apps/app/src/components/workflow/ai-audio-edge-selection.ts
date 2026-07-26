import type { Edge as ReactFlowEdge } from "@xyflow/react";

import { resolveWorkflowEdgeHandles } from "./ai-text-connection-utils";
import {
  AI_AUDIO_OUTPUT_ID,
  AI_AUDIO_PROMPT_HANDLE_ID,
} from "./ai-audio-node-utils";
import type { WorkflowEdgeType } from "./workflow-types";

type FirstDegreeEdge = Pick<
  ReactFlowEdge<WorkflowEdgeType>,
  "id" | "source" | "target" | "sourceHandle" | "targetHandle" | "data"
>;

/** First-level edges directly attached to an AI audio node (prompt in, audios out). */
export function collectAiAudioFirstDegreeEdgeIds(
  nodeId: string,
  edges: readonly FirstDegreeEdge[]
): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const edge of edges) {
    const resolved = resolveWorkflowEdgeHandles({
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      dataSourceHandle:
        typeof edge.data?.sourceType === "string" ? edge.data.sourceType : null,
      dataTargetHandle:
        typeof edge.data?.targetType === "string" ? edge.data.targetType : null,
    });

    if (
      edge.target === nodeId &&
      resolved.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
    ) {
      ids.add(edge.id);
    }

    if (
      edge.source === nodeId &&
      resolved.sourceHandle === AI_AUDIO_OUTPUT_ID
    ) {
      ids.add(edge.id);
    }
  }

  return ids;
}
