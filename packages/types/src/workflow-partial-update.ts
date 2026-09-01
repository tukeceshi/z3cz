import type {
  Edge,
  Node,
  WorkflowEditorViewport,
  WorkflowGenerativeDefaults,
  WorkflowRuntime,
  WorkflowState,
  WorkflowTrigger,
} from "./workflow";

/**
 * Identity fields required on every `update` WebSocket message.
 * Graph fields (`nodes` / `edges`) are optional for meta-only updates.
 */
export interface WorkflowPartialState {
  readonly id: string;
  readonly name: string;
  readonly trigger: WorkflowTrigger;
  readonly timestamp: number;
  readonly schemeId?: string;
  readonly description?: string;
  readonly runtime?: WorkflowRuntime;
  readonly editorViewport?: WorkflowEditorViewport;
  readonly generativeDefaults?: WorkflowGenerativeDefaults;
  readonly nodes?: Node[];
  readonly edges?: Edge[];
}

export function hasWorkflowGraphInPartial(
  state: WorkflowPartialState
): state is WorkflowPartialState & { nodes: Node[]; edges: Edge[] } {
  return Array.isArray(state.nodes) && Array.isArray(state.edges);
}

export function mergeWorkflowPartialState(
  base: WorkflowState,
  partial: WorkflowPartialState
): WorkflowState {
  if (partial.id !== base.id) {
    return base;
  }

  const hasGraph = hasWorkflowGraphInPartial(partial);

  let nodes = base.nodes;
  let edges = base.edges;

  if (hasGraph) {
    const nodeIds = new Set(partial.nodes.map((node) => node.id));
    nodes = partial.nodes;
    edges = partial.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }

  return {
    ...base,
    name: partial.name,
    ...(partial.schemeId !== undefined && { schemeId: partial.schemeId }),
    ...(partial.description !== undefined && {
      description: partial.description,
    }),
    trigger: partial.trigger,
    ...(partial.runtime !== undefined && { runtime: partial.runtime }),
    ...(partial.editorViewport !== undefined && {
      editorViewport: partial.editorViewport,
    }),
    ...(partial.generativeDefaults !== undefined && {
      generativeDefaults: partial.generativeDefaults,
    }),
    nodes,
    edges,
    timestamp: partial.timestamp,
  };
}

/** Build the partial payload echoed to other tabs (only fields present in the inbound update). */
export function buildWorkflowPartialBroadcast(
  merged: WorkflowState,
  inbound: WorkflowPartialState
): WorkflowPartialState {
  const hasGraph = hasWorkflowGraphInPartial(inbound);

  return {
    id: merged.id,
    name: merged.name,
    trigger: merged.trigger,
    timestamp: merged.timestamp,
    ...(inbound.schemeId !== undefined && { schemeId: merged.schemeId }),
    ...(inbound.description !== undefined && {
      description: merged.description,
    }),
    ...(inbound.runtime !== undefined && { runtime: merged.runtime }),
    ...(inbound.editorViewport !== undefined && {
      editorViewport: merged.editorViewport,
    }),
    ...(inbound.generativeDefaults !== undefined && {
      generativeDefaults: merged.generativeDefaults,
    }),
    ...(hasGraph && { nodes: merged.nodes, edges: merged.edges }),
  };
}

/** Minimal identity stub for meta-only client updates. */
export function buildWorkflowUpdateIdentity(
  state: Pick<WorkflowState, "id" | "name" | "trigger" | "schemeId">
): Pick<WorkflowPartialState, "id" | "name" | "trigger" | "schemeId"> {
  return {
    id: state.id,
    name: state.name,
    trigger: state.trigger,
    schemeId: state.schemeId,
  };
}
