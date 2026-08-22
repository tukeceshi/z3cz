import type {
  Edge as WorkflowBackendEdge,
  Node as WorkflowBackendNode,
  Parameter,
} from "@dafthunk/types";
import { mergeGenerativeNodeContentOnSave } from "@dafthunk/types";
import type { Edge, Node } from "@xyflow/react";

import { normalizeAiTextNodeDataForPersist } from "@/components/workflow/ai-text-persist-utils";
import { stripTransientGenerativeMetadata } from "@/components/workflow/generative-card-error-utils";
import type {
  WorkflowEdgeType,
  WorkflowNodeType,
} from "@/components/workflow/workflow-types";

/** Canvas wire-format graph — same shape as WS `patch_graph` payloads. */
export interface WorkflowCanvasJson {
  readonly nodes: WorkflowBackendNode[];
  readonly edges: WorkflowBackendEdge[];
}

/**
 * Convert React Flow graph into backend canvas JSON (persist / history / patch).
 */
export function buildWorkflowPayload(
  nodes: Node<WorkflowNodeType>[],
  edges: Edge<WorkflowEdgeType>[],
  options?: {
    readonly mergeFromPersisted?: readonly WorkflowBackendNode[];
  }
): WorkflowCanvasJson {
  const persistedById = new Map(
    (options?.mergeFromPersisted ?? []).map((node) => [node.id, node])
  );
  const workflowNodes = nodes.map((node) => {
    const incomingEdges = edges.filter((edge) => edge.target === node.id);
    const persistableData = normalizeAiTextNodeDataForPersist(node.data);
    const built = {
      id: node.id,
      name: persistableData.name,
      type: persistableData.nodeType || "default",
      position: node.position,
      icon: persistableData.icon,
      functionCalling: persistableData.functionCalling,
      ...(() => {
        const metadata = stripTransientGenerativeMetadata(persistableData.metadata);
        return metadata ? { metadata } : {};
      })(),
      inputs: persistableData.inputs.map((input) => {
        const isConnected = incomingEdges.some(
          (edge) => edge.targetHandle === input.id
        );
        const { id: _id, value: inputValue, ...rest } = input;
        const parameter = {
          ...rest,
          name: input.id,
          description: input.name,
        } as Parameter & { value?: unknown };
        if (!isConnected && typeof inputValue !== "undefined") {
          parameter.value = inputValue;
        }
        return parameter as Parameter;
      }),
      outputs: node.data.outputs.map((output) => {
        const { id: _id, value: _value, ...rest } = output;
        return {
          ...rest,
          name: output.id,
          description: output.name,
        } as Parameter;
      }),
    } as WorkflowBackendNode;
    const persisted = persistedById.get(node.id);
    if (persisted) {
      return mergeGenerativeNodeContentOnSave(persisted, built);
    }
    return built;
  }) as WorkflowBackendNode[];

  const workflowEdges = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    sourceOutput: edge.sourceHandle || "",
    targetInput: edge.targetHandle || "",
  })) as WorkflowBackendEdge[];

  return { nodes: workflowNodes, edges: workflowEdges };
}
