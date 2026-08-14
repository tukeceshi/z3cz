import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { useMemo } from "react";

import {
  isReferencedAiTextPendingFromEdges,
  resolveReferencedAiTextFromEdges,
} from "@/components/workflow/resolve-ai-text-result";
import type { WorkflowEdgeType, WorkflowNodeType } from "@/components/workflow/workflow-types";

interface UseResolvedReferencedPromptParams {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}

export interface ResolvedReferencedPrompt {
  readonly text: string;
  readonly loading: boolean;
}

export function useResolvedReferencedPrompt(
  params: UseResolvedReferencedPromptParams
): ResolvedReferencedPrompt {
  const graphKey = useMemo(
    () =>
      JSON.stringify({
        nodeId: params.nodeId,
        targetHandle: params.targetHandle,
        edges: params.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          targetHandle: edge.targetHandle,
        })),
        nodes: params.nodes.map((node) => ({
          id: node.id,
          excerpt: node.data.outputs?.find((output) => output.id === "text")?.value,
          body: node.data.outputs?.find((output) => output.id === "textBody")?.value,
          result: node.data.inputs?.find((input) => input.id === "result")?.value,
        })),
      }),
    [params.edges, params.nodeId, params.nodes, params.targetHandle]
  );

  return useMemo(() => {
    void graphKey;
    return {
      text: resolveReferencedAiTextFromEdges(params),
      loading: isReferencedAiTextPendingFromEdges(params),
    };
  }, [graphKey, params]);
}
