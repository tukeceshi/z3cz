export interface ArchivedWorkflowNode {
  readonly nodeId: string;
  readonly nodeType: string;
}

export interface ArchivedWorkflowDetection {
  readonly hasArchived: boolean;
  readonly archivedNodeIds: readonly string[];
  readonly archivedNodes: readonly ArchivedWorkflowNode[];
}

export { buildCatalogAllowedNodeTypeSet } from "@dafthunk/types";

export function findArchivedWorkflowNodes(  nodes: readonly { readonly id: string; readonly type: string }[],
  allowedNodeTypes: ReadonlySet<string>
): readonly ArchivedWorkflowNode[] {
  const archived: ArchivedWorkflowNode[] = [];
  for (const node of nodes) {
    if (!node.type || allowedNodeTypes.has(node.type)) {
      continue;
    }
    archived.push({ nodeId: node.id, nodeType: node.type });
  }
  return archived;
}

export function detectArchivedWorkflow(
  nodes: readonly { readonly id: string; readonly type: string }[],
  allowedNodeTypes: ReadonlySet<string>
): ArchivedWorkflowDetection {
  const archivedNodes = findArchivedWorkflowNodes(nodes, allowedNodeTypes);
  return {
    hasArchived: archivedNodes.length > 0,
    archivedNodeIds: archivedNodes.map((entry) => entry.nodeId),
    archivedNodes,
  };
}

export function assertWorkflowExecutableAgainstCatalog(
  nodes: readonly { readonly id: string; readonly type: string }[],
  allowedNodeTypes: ReadonlySet<string>
): void {
  const archived = findArchivedWorkflowNodes(nodes, allowedNodeTypes);
  if (archived.length === 0) {
    return;
  }
  const types = [...new Set(archived.map((entry) => entry.nodeType))].join(", ");
  throw new Error(
    `Workflow contains archived node types and cannot be executed: ${types}`
  );
}
