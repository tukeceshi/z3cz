import type { Node as ReactFlowNode } from "@xyflow/react";

import { resolveGenerativeNodeDisplayName } from "./generative-node-naming";
import { resolveTableReferenceTitle } from "./resolve-table-reference-title";
import { upsertNodeInputValue } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export interface ApplyGenerativeNodeStudioReferenceParams {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly nodeType: string;
  readonly existingNodes: ReadonlyArray<{
    readonly data: { readonly nodeType?: string };
  }>;
  readonly defaultBaseName: string;
  readonly prompt: string;
  readonly precedingText: string;
}

export function applyGenerativeNodeStudioReference(
  params: ApplyGenerativeNodeStudioReferenceParams
): ReactFlowNode<WorkflowNodeType> {
  const customTitle = resolveTableReferenceTitle(params.precedingText);
  const name =
    customTitle ??
    resolveGenerativeNodeDisplayName({
      nodeType: params.nodeType,
      baseName: params.defaultBaseName,
      existingNodes: params.existingNodes,
    });

  return {
    ...params.node,
    data: {
      ...params.node.data,
      name,
      inputs: upsertNodeInputValue(
        params.node.data.inputs,
        "prompt",
        params.prompt,
        "string"
      ),
    },
  };
}
