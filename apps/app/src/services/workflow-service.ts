import {
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  DeleteWorkflowResponse,
  Edge,
  ExecuteWorkflowResponse,
  GetWorkflowResponse,
  ListWorkflowsResponse,
  Node,
  UpdateWorkflowListMetadataRequest,
  UpdateWorkflowListMetadataResponse,
  UpdateWorkflowRequest,
  UpdateWorkflowResponse,
  WorkflowWithMetadata,
} from "@dafthunk/types";
import {
  Connection,
  Edge as ReactFlowEdge,
} from "@xyflow/react";
import useSWR, { type SWRConfiguration } from "swr";

import { useAuth } from "@/components/auth-context";

import { makeOrgRequest } from "./utils";

// Base endpoint for workflows
const API_ENDPOINT_BASE = "/workflows";

/**
 * Type representing a connection validation result
 */
export type ConnectionValidationResult =
  | { status: "valid" }
  | { status: "invalid"; reason: string };

/**
 * Hook to list workflows for the current organization (optionally scoped to a folder).
 */
export const useWorkflows = (folderId?: string | null): {
  workflows: WorkflowWithMetadata[];
  workflowsError: Error | null;
  isWorkflowsLoading: boolean;
  mutateWorkflows: () => Promise<WorkflowWithMetadata[] | undefined>;
} => {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const folderQuery =
    folderId === undefined
      ? ""
      : `?folderId=${folderId === null ? "root" : encodeURIComponent(folderId)}`;

  const swrKey = orgId
    ? `/${orgId}${API_ENDPOINT_BASE}${folderQuery}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    swrKey && orgId
      ? async () => {
          const response = await makeOrgRequest<ListWorkflowsResponse>(
            orgId,
            API_ENDPOINT_BASE,
            folderQuery
          );
          return response.workflows;
        }
      : null
  );

  return {
    workflows: data || [],
    workflowsError: error || null,
    isWorkflowsLoading: isLoading,
    mutateWorkflows: mutate,
  };
};

/**
 * Hook to get a specific workflow by ID
 */
export const useWorkflow = (
  id: string | null,
  options?: SWRConfiguration<WorkflowWithMetadata>
) => {
  const { organization } = useAuth();
  const orgId = organization?.id;

  // Create a unique SWR key that includes the organization ID and workflow ID
  const swrKey = orgId && id ? `/${orgId}${API_ENDPOINT_BASE}/${id}` : null;

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    swrKey && orgId && id
      ? async () => {
          return await makeOrgRequest<GetWorkflowResponse>(
            orgId,
            API_ENDPOINT_BASE,
            `/${id}`
          );
        }
      : null,
    options
  );

  return {
    workflow: data,
    workflowError: error || null,
    isWorkflowLoading: isLoading,
    mutateWorkflow: mutate,
  };
};

/**
 * Hook to get a specific workflow by ID with explicit orgId (for admin context)
 */
export const useWorkflowWithOrgId = (
  id: string | null,
  orgId: string | null,
  options?: SWRConfiguration<WorkflowWithMetadata>
) => {
  // Create a unique SWR key that includes the organization ID and workflow ID
  const swrKey = orgId && id ? `/${orgId}${API_ENDPOINT_BASE}/${id}` : null;

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    swrKey && orgId && id
      ? async () => {
          return await makeOrgRequest<GetWorkflowResponse>(
            orgId,
            API_ENDPOINT_BASE,
            `/${id}`
          );
        }
      : null,
    options
  );

  return {
    workflow: data,
    workflowError: error || null,
    isWorkflowLoading: isLoading,
    mutateWorkflow: mutate,
  };
};

/**
 * Create a new workflow for the current organization
 */
export const createWorkflow = async (
  request: CreateWorkflowRequest,
  orgId: string
): Promise<WorkflowWithMetadata> => {
  const response = await makeOrgRequest<CreateWorkflowResponse>(
    orgId,
    API_ENDPOINT_BASE,
    "",
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );

  return response;
};

/**
 * Update an existing workflow
 */
export const updateWorkflow = async (
  id: string,
  request: UpdateWorkflowRequest,
  orgId: string
): Promise<WorkflowWithMetadata> => {
  const response = await makeOrgRequest<UpdateWorkflowResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(request),
    }
  );

  return response;
};

export const updateWorkflowListMetadata = async (
  id: string,
  request: UpdateWorkflowListMetadataRequest,
  orgId: string
): Promise<WorkflowWithMetadata> => {
  return makeOrgRequest<UpdateWorkflowListMetadataResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${id}/list-metadata`,
    {
      method: "PATCH",
      body: JSON.stringify(request),
    }
  );
};

/**
 * Get a workflow by ID
 */
export const getWorkflow = async (
  id: string,
  orgId: string
): Promise<WorkflowWithMetadata> => {
  return await makeOrgRequest<GetWorkflowResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${id}`
  );
};

/**
 * Execute a single node of a workflow in isolation (dev / AI panel "Run").
 * Returns the full workflow execution record including node outputs.
 */
export const executeWorkflowNode = async (
  workflowId: string,
  nodeId: string,
  orgId: string,
  node?: Node,
  subgraph?: { nodes: Node[]; edges: Edge[] }
): Promise<ExecuteWorkflowResponse> => {
  return await makeOrgRequest<ExecuteWorkflowResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${workflowId}/nodes/${nodeId}/execute`,
    {
      method: "POST",
      body: JSON.stringify(
        subgraph
          ? { node, nodes: subgraph.nodes, edges: subgraph.edges }
          : node
            ? { node }
            : {}
      ),
    }
  );
};

/**
 * Delete a workflow by ID
 */
export const deleteWorkflow = async (
  id: string,
  orgId: string
): Promise<DeleteWorkflowResponse> => {
  return await makeOrgRequest<DeleteWorkflowResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${id}`,
    {
      method: "DELETE",
    }
  );
};

/**
 * Converts workflow edges to ReactFlow compatible edges
 */
export const convertToReactFlowEdges = (
  edges: readonly Edge[]
): readonly ReactFlowEdge[] => {
  return edges.map((edge) => ({
    id: `e-${edge.source}-${edge.sourceOutput}-${edge.target}-${edge.targetInput}`,
    type: "workflowEdge",
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceOutput,
    targetHandle: edge.targetInput,
  }));
};

/**
 * Validates a connection between two nodes
 */
export const validateConnection = (
  connection: Connection,
  edges: readonly ReactFlowEdge[]
): ConnectionValidationResult => {
  if (!connection.source || !connection.target) {
    return {
      status: "invalid",
      reason: "Missing source or target",
    };
  }

  const sourceNode = connection.source;
  const targetNode = connection.target;

  // Prevent self-connections
  if (sourceNode === targetNode) {
    return {
      status: "invalid",
      reason: "Cannot connect a node to itself",
    };
  }

  // Check for direct cycles (A→B→A)
  const directCycle = edges.some(
    (edge) => edge.source === targetNode && edge.target === sourceNode
  );

  if (directCycle) {
    return {
      status: "invalid",
      reason: "Would create a direct cycle",
    };
  }

  // Check for indirect cycles (A→B→C→A)
  if (wouldCreateIndirectCycle(sourceNode, targetNode, edges)) {
    return {
      status: "invalid",
      reason: "Would create an indirect cycle",
    };
  }

  return { status: "valid" };
};

/**
 * Checks if adding an edge would create an indirect cycle in the graph
 * @private Used internally by validateConnection
 */
const wouldCreateIndirectCycle = (
  sourceNode: string,
  targetNode: string,
  edges: readonly ReactFlowEdge[]
): boolean => {
  // Use depth-first search to check if target can reach source
  const visited = new Set<string>();

  const dfs = (currentNode: string): boolean => {
    if (currentNode === sourceNode) return true;
    if (visited.has(currentNode)) return false;

    visited.add(currentNode);

    // Find all outgoing edges from current node
    const outgoingEdges = edges.filter((edge) => edge.source === currentNode);

    for (const edge of outgoingEdges) {
      if (dfs(edge.target)) return true;
    }

    return false;
  };

  return dfs(targetNode);
};
