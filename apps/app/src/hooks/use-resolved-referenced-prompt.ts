import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
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
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const organizationId = organization?.id;

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
          result: node.data.inputs?.find((input) => input.id === "result")?.value,
          staging: node.data.metadata?.aiTextStagingState,
          generating: node.data.metadata?.aiTextGenerating,
        })),
      }),
    [params.edges, params.nodeId, params.nodes, params.targetHandle]
  );

  const pending = useMemo(() => {
    void graphKey;
    return isReferencedAiTextPendingFromEdges(params);
  }, [graphKey, params]);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(pending);

  useEffect(() => {
    let cancelled = false;
    setLoading(pending);

    void resolveReferencedAiTextFromEdges({
      ...params,
      organizationId,
      workflowId,
    }).then((resolved) => {
      if (cancelled) {
        return;
      }
      setText(resolved);
      setLoading(pending && !resolved.trim());
    });

    return () => {
      cancelled = true;
    };
  }, [graphKey, organizationId, pending, workflowId]);

  return { text, loading };
}
