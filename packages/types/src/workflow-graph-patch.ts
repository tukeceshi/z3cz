import type { Edge, Node, WorkflowState } from "./workflow";

export type WorkflowNodePatch =
  | { readonly type: "add"; readonly node: Node }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "position"; readonly id: string; readonly position: Node["position"] }
  | { readonly type: "update"; readonly node: Node };

export type WorkflowEdgePatch =
  | { readonly type: "add"; readonly edge: Edge }
  | { readonly type: "remove"; readonly edge: Edge };

export interface WorkflowGraphPatchPayload {
  readonly nodePatches: readonly WorkflowNodePatch[];
  readonly edgePatches: readonly WorkflowEdgePatch[];
}

export interface WorkflowGraphPatchMessage extends WorkflowGraphPatchPayload {
  readonly type: "patch_graph";
  /** Last rev the client applied; informational only (last-write-wins). */
  readonly baseRev?: number;
}

export interface WorkflowGraphPatchBroadcast extends WorkflowGraphPatchMessage {
  readonly rev: number;
  readonly timestamp: number;
}

const edgeKey = (edge: Edge): string =>
  `${edge.source}:${edge.sourceOutput}->${edge.target}:${edge.targetInput}`;

const nodeEquals = (a: Node, b: Node): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function diffWorkflowGraph(
  previous: { readonly nodes: readonly Node[]; readonly edges: readonly Edge[] },
  next: { readonly nodes: readonly Node[]; readonly edges: readonly Edge[] }
): WorkflowGraphPatchPayload {
  const nodePatches: WorkflowNodePatch[] = [];
  const edgePatches: WorkflowEdgePatch[] = [];

  const prevNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  const nextNodes = new Map(next.nodes.map((node) => [node.id, node]));

  for (const id of prevNodes.keys()) {
    if (!nextNodes.has(id)) {
      nodePatches.push({ type: "remove", id });
    }
  }

  for (const [id, nextNode] of nextNodes) {
    const prevNode = prevNodes.get(id);
    if (!prevNode) {
      nodePatches.push({ type: "add", node: nextNode });
      continue;
    }

    const positionChanged =
      prevNode.position.x !== nextNode.position.x ||
      prevNode.position.y !== nextNode.position.y;
    const prevAligned = { ...prevNode, position: nextNode.position };
    const dataChanged = !nodeEquals(prevAligned, nextNode);

    if (positionChanged && !dataChanged) {
      nodePatches.push({
        type: "position",
        id,
        position: nextNode.position,
      });
    } else if (dataChanged) {
      nodePatches.push({ type: "update", node: nextNode });
    }
  }

  const prevEdges = new Map(previous.edges.map((edge) => [edgeKey(edge), edge]));
  const nextEdges = new Map(next.edges.map((edge) => [edgeKey(edge), edge]));

  for (const [key, edge] of prevEdges) {
    if (!nextEdges.has(key)) {
      edgePatches.push({ type: "remove", edge });
    }
  }

  for (const [, edge] of nextEdges) {
    if (!prevEdges.has(edgeKey(edge))) {
      edgePatches.push({ type: "add", edge });
    }
  }

  return { nodePatches, edgePatches };
}

export function applyWorkflowGraphPatch(
  state: WorkflowState,
  patch: WorkflowGraphPatchPayload
): WorkflowState {
  let nodes = [...state.nodes];
  let edges = [...state.edges];

  for (const nodePatch of patch.nodePatches) {
    switch (nodePatch.type) {
      case "add":
        if (!nodes.some((node) => node.id === nodePatch.node.id)) {
          nodes.push(nodePatch.node);
        }
        break;
      case "remove":
        nodes = nodes.filter((node) => node.id !== nodePatch.id);
        edges = edges.filter(
          (edge) =>
            edge.source !== nodePatch.id && edge.target !== nodePatch.id
        );
        break;
      case "position":
        nodes = nodes.map((node) =>
          node.id === nodePatch.id
            ? { ...node, position: nodePatch.position }
            : node
        );
        break;
      case "update":
        nodes = nodes.map((node) =>
          node.id === nodePatch.node.id ? nodePatch.node : node
        );
        break;
      default: {
        const _exhaustive: never = nodePatch;
        void _exhaustive;
      }
    }
  }

  for (const edgePatch of patch.edgePatches) {
    const key = edgeKey(edgePatch.edge);
    switch (edgePatch.type) {
      case "add": {
        const nodeIds = new Set(nodes.map((node) => node.id));
        if (
          nodeIds.has(edgePatch.edge.source) &&
          nodeIds.has(edgePatch.edge.target) &&
          !edges.some((edge) => edgeKey(edge) === key)
        ) {
          edges.push(edgePatch.edge);
        }
        break;
      }
      case "remove":
        edges = edges.filter((edge) => edgeKey(edge) !== key);
        break;
      default: {
        const _exhaustive: never = edgePatch;
        void _exhaustive;
      }
    }
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  edges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return {
    ...state,
    nodes,
    edges,
  };
}

export function isEmptyWorkflowGraphPatch(
  patch: WorkflowGraphPatchPayload
): boolean {
  return patch.nodePatches.length === 0 && patch.edgePatches.length === 0;
}
