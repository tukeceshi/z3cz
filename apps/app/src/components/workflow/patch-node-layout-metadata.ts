import {
  nodeLayoutMetadataEntries,
  type PatchNodeLayoutMetadata,
} from "@dafthunk/types";

import type { WorkflowNodeType } from "./workflow-types";

type UpdateNodeDataFn = (
  nodeId: string,
  data:
    | Partial<WorkflowNodeType>
    | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
) => void;

export function createPatchNodeLayoutMetadata(
  nodeId: string,
  updateNodeData: UpdateNodeDataFn
): PatchNodeLayoutMetadata {
  return (layout) => {
    updateNodeData(nodeId, (current) => ({
      metadata: {
        ...current.metadata,
        ...nodeLayoutMetadataEntries(layout),
      },
    }));
  };
}
