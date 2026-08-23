import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { WORKFLOW_NODE_GAP_PX } from "./workflow-node-placement";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

/** LibTV canvas grid snap. */
export const WORKFLOW_LAYOUT_SNAP_GRID_PX = 12;

/** Gap between disconnected component bounding boxes. */
export const WORKFLOW_LAYOUT_COMPONENT_GAP_PX = WORKFLOW_NODE_GAP_PX * 1.5;

/** Wrap laid-out components to the next row when exceeding this width. */
export const WORKFLOW_LAYOUT_COMPONENT_WRAP_WIDTH_PX = 3200;

export interface LayoutPosition {
  readonly x: number;
  readonly y: number;
}

export interface LayoutPositionUpdate {
  readonly id: string;
  readonly position: LayoutPosition;
}

interface LayoutNodeDimensions {
  readonly width: number;
  readonly height: number;
}

interface ElkLayoutNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

interface ElkLayoutEdge {
  readonly id: string;
  readonly sources: readonly string[];
  readonly targets: readonly string[];
}

interface ElkLayoutGraph {
  readonly id: string;
  readonly layoutOptions: Readonly<Record<string, string>>;
  readonly children: readonly ElkLayoutNode[];
  readonly edges: readonly ElkLayoutEdge[];
}

interface ElkLayoutResultChild {
  readonly id?: string;
  readonly x?: number;
  readonly y?: number;
}

interface ElkLayoutResult {
  readonly children?: readonly ElkLayoutResultChild[];
}

interface ElkLayoutEngine {
  layout(graph: ElkLayoutGraph): Promise<ElkLayoutResult>;
}

type OrganizeLayoutNode = Pick<
  ReactFlowNode<WorkflowNodeType>,
  "id" | "position" | "data" | "measured" | "width" | "height"
>;

let elkLayoutEngine: ElkLayoutEngine | null = null;

async function getElkLayoutEngine(): Promise<ElkLayoutEngine> {
  if (elkLayoutEngine) return elkLayoutEngine;

  try {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    elkLayoutEngine = new ELK() as ElkLayoutEngine;
    return elkLayoutEngine;
  } catch (error) {
    elkLayoutEngine = null;
    throw error;
  }
}

export function snapLayoutCoordinate(value: number): number {
  return (
    Math.round(value / WORKFLOW_LAYOUT_SNAP_GRID_PX) *
    WORKFLOW_LAYOUT_SNAP_GRID_PX
  );
}

function createUnionFind(nodeIds: readonly string[]) {
  const parent = new Map<string, string>();

  const find = (nodeId: string): string => {
    let current = nodeId;
    while (parent.get(current) !== current) {
      current = parent.get(current) ?? current;
    }

    let cursor = nodeId;
    while (parent.get(cursor) !== current) {
      const next = parent.get(cursor) ?? cursor;
      parent.set(cursor, current);
      cursor = next;
    }

    return current;
  };

  const union = (leftId: string, rightId: string): void => {
    const leftRoot = find(leftId);
    const rightRoot = find(rightId);
    if (leftRoot !== rightRoot) {
      parent.set(leftRoot, rightRoot);
    }
  };

  for (const nodeId of nodeIds) {
    parent.set(nodeId, nodeId);
  }

  return { find, union };
}

function sortNodesForComponentOrder(
  left: OrganizeLayoutNode,
  right: OrganizeLayoutNode
): number {
  const deltaY = left.position.y - right.position.y;
  if (Math.abs(deltaY) > 1) return deltaY;
  return left.position.x - right.position.x;
}

function sortComponentsForLayoutOrder(
  left: readonly OrganizeLayoutNode[],
  right: readonly OrganizeLayoutNode[]
): number {
  const leftMinY = Math.min(...left.map((node) => node.position.y));
  const rightMinY = Math.min(...right.map((node) => node.position.y));
  const deltaY = leftMinY - rightMinY;
  if (Math.abs(deltaY) > 1) return deltaY;

  const leftMinX = Math.min(...left.map((node) => node.position.x));
  const rightMinX = Math.min(...right.map((node) => node.position.x));
  return leftMinX - rightMinX;
}

export function groupNodesByConnectedComponent(
  nodes: readonly OrganizeLayoutNode[],
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[]
): OrganizeLayoutNode[][] {
  if (nodes.length === 0) return [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const unionFind = createUnionFind([...nodeIds]);

  for (const edge of edges) {
    const { source, target } = edge;
    if (source === target) continue;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    unionFind.union(source, target);
  }

  const componentsByRoot = new Map<string, OrganizeLayoutNode[]>();
  for (const node of nodes) {
    const rootId = unionFind.find(node.id);
    const group = componentsByRoot.get(rootId);
    if (group) {
      group.push(node);
    } else {
      componentsByRoot.set(rootId, [node]);
    }
  }

  return [...componentsByRoot.values()]
    .map((component) => [...component].sort(sortNodesForComponentOrder))
    .sort(sortComponentsForLayoutOrder);
}

export function normalizeLayoutOrigin(
  positions: Map<string, LayoutPosition>
): void {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;

  for (const position of positions.values()) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

  for (const [nodeId, position] of positions) {
    positions.set(nodeId, {
      x: position.x - minX,
      y: position.y - minY,
    });
  }
}

export function computeLayoutComponentBounds(
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutNodeDimensions>
): { readonly width: number; readonly height: number } {
  let maxRight = 0;
  let maxBottom = 0;

  for (const [nodeId, position] of positions) {
    const size = dimensions.get(nodeId);
    if (!size) continue;
    maxRight = Math.max(maxRight, position.x + size.width);
    maxBottom = Math.max(maxBottom, position.y + size.height);
  }

  return { width: maxRight, height: maxBottom };
}

function buildElkLayoutGraph(
  componentNodeIds: ReadonlySet<string>,
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  dimensions: ReadonlyMap<string, LayoutNodeDimensions>
): ElkLayoutGraph {
  const children: ElkLayoutNode[] = [];
  for (const nodeId of componentNodeIds) {
    const size = dimensions.get(nodeId);
    if (!size) continue;
    children.push({
      id: nodeId,
      width: Math.max(1, size.width),
      height: Math.max(1, size.height),
    });
  }

  const seenEdges = new Set<string>();
  const elkEdges: ElkLayoutEdge[] = [];
  for (const edge of edges) {
    const { source, target } = edge;
    if (source === target) continue;
    if (!componentNodeIds.has(source) || !componentNodeIds.has(target)) {
      continue;
    }

    const edgeKey = `${source}->${target}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    elkEdges.push({
      id: `e-${source}-${target}`,
      sources: [source],
      targets: [target],
    });
  }

  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": String(WORKFLOW_NODE_GAP_PX),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(
        WORKFLOW_NODE_GAP_PX * 2
      ),
      "elk.padding": "[ top=0, left=0, bottom=0, right=0 ]",
    },
    children,
    edges: elkEdges,
  };
}

async function layoutConnectedComponent(
  component: readonly OrganizeLayoutNode[],
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  dimensions: ReadonlyMap<string, LayoutNodeDimensions>,
  elk: ElkLayoutEngine
): Promise<Map<string, LayoutPosition>> {
  const componentNodeIds = new Set(component.map((node) => node.id));
  const graph = buildElkLayoutGraph(componentNodeIds, edges, dimensions);

  try {
    const result = await elk.layout(graph);
    const positions = new Map<string, LayoutPosition>();

    for (const child of result.children ?? []) {
      if (!child.id) continue;
      positions.set(child.id, {
        x: child.x ?? 0,
        y: child.y ?? 0,
      });
    }

    normalizeLayoutOrigin(positions);
    return positions;
  } catch {
    return new Map(
      component.map((node) => [node.id, { x: 0, y: 0 }] as const)
    );
  }
}

function stitchComponentLayouts(
  components: ReadonlyArray<{
    readonly positions: ReadonlyMap<string, LayoutPosition>;
    readonly width: number;
    readonly height: number;
  }>,
  nodesById: ReadonlyMap<string, OrganizeLayoutNode>,
  anchorX: number,
  anchorY: number
): LayoutPositionUpdate[] {
  const updates: LayoutPositionUpdate[] = [];
  let cursorX = anchorX;
  let cursorY = anchorY;
  let rowMaxHeight = 0;

  for (const component of components) {
    if (
      cursorX > anchorX &&
      cursorX + component.width > anchorX + WORKFLOW_LAYOUT_COMPONENT_WRAP_WIDTH_PX
    ) {
      cursorY += rowMaxHeight + WORKFLOW_LAYOUT_COMPONENT_GAP_PX;
      cursorX = anchorX;
      rowMaxHeight = 0;
    }

    for (const [nodeId, localPosition] of component.positions) {
      const node = nodesById.get(nodeId);
      if (!node) continue;

      const nextPosition = {
        x: snapLayoutCoordinate(cursorX + localPosition.x),
        y: snapLayoutCoordinate(cursorY + localPosition.y),
      };

      if (
        Math.abs(nextPosition.x - node.position.x) > 0.5 ||
        Math.abs(nextPosition.y - node.position.y) > 0.5
      ) {
        updates.push({ id: nodeId, position: nextPosition });
      }
    }

    cursorX += component.width + WORKFLOW_LAYOUT_COMPONENT_GAP_PX;
    rowMaxHeight = Math.max(rowMaxHeight, component.height);
  }

  return updates;
}

export async function computeWorkflowOrganizeLayoutUpdates(
  nodes: readonly OrganizeLayoutNode[],
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  resolveDimensions: (node: OrganizeLayoutNode) => LayoutNodeDimensions
): Promise<LayoutPositionUpdate[]> {
  if (nodes.length <= 1) return [];

  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const dimensions = new Map(
    nodes.map((node) => [node.id, resolveDimensions(node)] as const)
  );

  const components = groupNodesByConnectedComponent(nodes, edges);
  const elk = await getElkLayoutEngine();

  const laidOutComponents: Array<{
    positions: Map<string, LayoutPosition>;
    width: number;
    height: number;
  }> = [];

  for (const component of components) {
    const positions = await layoutConnectedComponent(
      component,
      edges,
      dimensions,
      elk
    );
    if (positions.size === 0) continue;

    const bounds = computeLayoutComponentBounds(positions, dimensions);
    laidOutComponents.push({
      positions,
      width: bounds.width,
      height: bounds.height,
    });
  }

  if (laidOutComponents.length === 0) return [];

  const anchorX = snapLayoutCoordinate(
    Math.min(...nodes.map((node) => node.position.x))
  );
  const anchorY = snapLayoutCoordinate(
    Math.min(...nodes.map((node) => node.position.y))
  );

  return stitchComponentLayouts(
    laidOutComponents,
    nodesById,
    anchorX,
    anchorY
  );
}
