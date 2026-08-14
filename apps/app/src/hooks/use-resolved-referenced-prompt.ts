import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";

import { resolveReferencedAiTextFromEdges } from "@/components/workflow/resolve-ai-text-result";
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
  readonly organizationId?: string;
  readonly workflowId?: string;
}

export interface ResolvedReferencedPrompt {
  readonly text: string;
  readonly loading: boolean;
}

export function useResolvedReferencedPrompt(
  params: UseResolvedReferencedPromptParams
): ResolvedReferencedPrompt {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

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
          result: node.data.inputs?.find((input) => input.id === "result")?.value,
          output: node.data.outputs?.find((output) => output.id === "text")?.value,
        })),
      }),
    [params.edges, params.nodeId, params.nodes, params.targetHandle]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void resolveReferencedAiTextFromEdges(params).then((resolved) => {
      if (cancelled) {
        return;
      }
      setText(resolved);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    graphKey,
    params.organizationId,
    params.workflowId,
    params.edges,
    params.nodeId,
    params.nodes,
    params.targetHandle,
  ]);

  return { text, loading };
}
