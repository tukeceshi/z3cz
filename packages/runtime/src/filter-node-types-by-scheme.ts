import type { NodeType } from "@dafthunk/types";
import type { WorkflowSchemeNodeRules } from "@dafthunk/types";

export function isSchemeNodeCatalogUnrestricted(
  nodeRules: WorkflowSchemeNodeRules
): boolean {
  const hasIncludeTags =
    nodeRules.includeTags !== undefined && nodeRules.includeTags.length > 0;
  const hasIncludeNodeTypes =
    nodeRules.includeNodeTypes !== undefined &&
    nodeRules.includeNodeTypes.length > 0;
  return !hasIncludeTags && !hasIncludeNodeTypes;
}

export function filterNodeTypesByScheme(
  allNodeTypes: NodeType[],
  nodeRules: WorkflowSchemeNodeRules
): NodeType[] {
  const exclude = new Set(nodeRules.excludeNodeTypes ?? []);
  const alwaysInclude = new Set(nodeRules.alwaysIncludeNodeTypes ?? []);

  if (isSchemeNodeCatalogUnrestricted(nodeRules)) {
    if (exclude.size === 0) {
      return allNodeTypes;
    }
    return allNodeTypes.filter(
      (nodeType) => alwaysInclude.has(nodeType.type) || !exclude.has(nodeType.type)
    );
  }

  const includeTags = new Set(nodeRules.includeTags ?? []);
  const includeNodeTypes = new Set(nodeRules.includeNodeTypes ?? []);

  return allNodeTypes.filter((nodeType) => {
    if (alwaysInclude.has(nodeType.type)) {
      return true;
    }
    if (exclude.has(nodeType.type)) {
      return false;
    }
    if (includeNodeTypes.has(nodeType.type)) {
      return true;
    }
    if (nodeType.functionCalling && includeTags.has("Tools")) {
      return true;
    }
    return nodeType.tags.some((tag) => includeTags.has(tag));
  });
}

export function buildSchemeAllowedNodeTypeSet(
  allNodeTypes: NodeType[],
  nodeRules: WorkflowSchemeNodeRules
): Set<string> {
  return new Set(
    filterNodeTypesByScheme(allNodeTypes, nodeRules).map(
      (nodeType) => nodeType.type
    )
  );
}
