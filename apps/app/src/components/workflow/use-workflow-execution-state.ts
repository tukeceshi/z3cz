import type { WorkflowRuntime } from "@dafthunk/types";
import {
  isSubscriptionRequiredError,
  parseSubscriptionRequiredError,
} from "@dafthunk/utils";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { HttpRequestConfig } from "@/components/workflow/http-request-config-dialog";
import type { WorkflowRunConfig } from "@/components/workflow/workflow-run-config-dialog";
import { useBilling } from "@/services/billing-service";
import { useWorkflowExecution } from "@/services/workflow-service";

import type {
  NodeExecutionState,
  NodeExecutionUpdate,
  NodeType,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowNodeType,
  WorkflowParameter,
} from "./workflow-types";

interface UseWorkflowExecutionStateProps {
  workflowId: string;
  workflowRuntime: WorkflowRuntime;
  orgId: string;
  nodes: ReactFlowNode<WorkflowNodeType>[];
  nodeTypes: NodeType[];
  initialWorkflowExecution?: WorkflowExecution;
  onPersistRuntime?: (runtime: WorkflowRuntime) => void;
  executeWorkflow?: (
    workflowId: string,
    onExecution: (execution: WorkflowExecution) => void,
    triggerData?: unknown
  ) => void | (() => void | Promise<void>);
  wsExecuteWorkflow?: (options?: {
    parameters?: Record<string, unknown>;
  }) => void;
  updateNodeExecution: (nodeId: string, update: NodeExecutionUpdate) => void;
  batchUpdateNodeExecutions?: (
    updates: Readonly<Record<string, NodeExecutionUpdate>>
  ) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeType>) => void;
  deselectAll: () => void;
}

interface UseWorkflowExecutionStateReturn {
  workflowStatus: WorkflowExecutionStatus;
  workflowErrorMessage?: string;
  currentExecutionId?: string;
  errorDialogOpen: boolean;
  setErrorDialogOpen: (open: boolean) => void;
  handleActionButtonClick: (e: React.MouseEvent) => void;
  isRunConfigDialogVisible: boolean;
  setRunConfigDialogVisible: (open: boolean) => void;
  confirmRunConfig: (config: WorkflowRunConfig) => void;
  isHttpRequestConfigDialogVisible: boolean;
  submitHttpRequestConfig: (data: HttpRequestConfig) => void;
  closeExecutionForm: () => void;
  executeRef: React.RefObject<((triggerData?: unknown) => void) | null>;
  upgradeDialogOpen: boolean;
  setUpgradeDialogOpen: (open: boolean) => void;
  upgradeDialogVariant: "preflight" | "post-failure";
  upgradeDialogGatedNodeTypes: NodeType[];
}

function applyInitialExecution(
  execution: WorkflowExecution,
  nodes: ReactFlowNode<WorkflowNodeType>[],
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeType>) => void
) {
  execution.nodeExecutions.forEach((nodeExec) => {
    const node = nodes.find((n) => n.id === nodeExec.nodeId);
    if (!node) return;

    const updatedOutputs = node.data.outputs.map((output) => {
      const outputValue =
        nodeExec.outputs?.[output.id] ?? nodeExec.outputs?.[output.name];
      return { ...output, value: outputValue } as WorkflowParameter;
    });

    const executionState =
      nodeExec.status === "idle" &&
      updatedOutputs.some((o) => o.value !== undefined)
        ? "completed"
        : nodeExec.status;

    updateNodeData(nodeExec.nodeId, {
      outputs: updatedOutputs,
      executionState,
      error: nodeExec.error,
    });
  });
}

export function useWorkflowExecutionState({
  workflowId,
  workflowRuntime,
  orgId,
  nodes,
  nodeTypes,
  initialWorkflowExecution,
  onPersistRuntime,
  executeWorkflow,
  wsExecuteWorkflow,
  updateNodeExecution,
  batchUpdateNodeExecutions,
  updateNodeData,
  deselectAll,
}: UseWorkflowExecutionStateProps): UseWorkflowExecutionStateReturn {
  const applyExecutionUpdates = useCallback(
    (updates: Readonly<Record<string, NodeExecutionUpdate>>) => {
      if (batchUpdateNodeExecutions) {
        batchUpdateNodeExecutions(updates);
        return;
      }
      for (const [nodeId, update] of Object.entries(updates)) {
        updateNodeExecution(nodeId, update);
      }
    },
    [batchUpdateNodeExecutions, updateNodeExecution]
  );
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowExecutionStatus>(
    initialWorkflowExecution?.status || "idle"
  );
  const statusRef = useRef<WorkflowExecutionStatus>(
    initialWorkflowExecution?.status || "idle"
  );
  const [workflowErrorMessage, setWorkflowErrorMessage] = useState<
    string | undefined
  >(initialWorkflowExecution?.error);
  const [errorDialogOpen, setErrorDialogOpen] = useState(
    initialWorkflowExecution?.status === "exhausted"
  );
  const [currentExecutionId, setCurrentExecutionId] = useState<
    string | undefined
  >(initialWorkflowExecution?.id);
  const [isRunConfigDialogVisible, setRunConfigDialogVisible] = useState(false);

  const { billing } = useBilling();
  const isPro = billing?.plan === "pro";
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeDialogVariant, setUpgradeDialogVariant] = useState<
    "preflight" | "post-failure"
  >("preflight");
  const [upgradeDialogGatedNodeTypes, setUpgradeDialogGatedNodeTypes] =
    useState<NodeType[]>([]);

  const nodeTypeById = useMemo(() => {
    const map = new Map<string, NodeType>();
    for (const nt of nodeTypes) map.set(nt.type, nt);
    return map;
  }, [nodeTypes]);

  const findGatedNodeTypes = useCallback((): NodeType[] => {
    const seen = new Set<string>();
    const gated: NodeType[] = [];
    for (const node of nodes) {
      const typeId = node.data.nodeType;
      if (!typeId || seen.has(typeId)) continue;
      const nt = nodeTypeById.get(typeId);
      if (nt?.subscription) {
        seen.add(typeId);
        gated.push(nt);
      }
    }
    return gated;
  }, [nodes, nodeTypeById]);

  const cleanupRef = useRef<(() => void | Promise<void>) | null>(null);
  const initializedRef = useRef(false);
  const executeRef = useRef<((triggerData?: unknown) => void) | null>(null);
  const executionCallbackRef = useRef<
    ((execution: WorkflowExecution) => void) | null
  >(null);

  const wsExecuteWorkflowWrapper = useCallback(
    (options?: { parameters?: Record<string, unknown> }) => {
      if (executeWorkflow && executionCallbackRef.current) {
        executeWorkflow(
          workflowId,
          executionCallbackRef.current,
          options?.parameters
        );
      } else if (wsExecuteWorkflow) {
        wsExecuteWorkflow(options);
      }
    },
    [executeWorkflow, wsExecuteWorkflow, workflowId]
  );

  const {
    executeWorkflow: executeWorkflowWithForm,
    isHttpRequestConfigDialogVisible,
    submitHttpRequestConfig,
    closeExecutionForm,
  } = useWorkflowExecution(orgId, wsExecuteWorkflowWrapper);

  useEffect(() => {
    if (
      initialWorkflowExecution &&
      !initializedRef.current &&
      nodes.length > 0
    ) {
      initializedRef.current = true;
      statusRef.current = initialWorkflowExecution.status;
      setWorkflowStatus(initialWorkflowExecution.status);
      applyInitialExecution(initialWorkflowExecution, nodes, updateNodeData);

      if (initialWorkflowExecution.status === "exhausted") {
        setErrorDialogOpen(true);
      }
    }
  }, [initialWorkflowExecution, nodes, updateNodeData]);

  const resetNodeStates = useCallback(
    (state: NodeExecutionState = "idle") => {
      applyExecutionUpdates(
        Object.fromEntries(
          nodes.map((node) => [
            node.id,
            { state, outputs: {}, error: undefined },
          ])
        )
      );
      setWorkflowErrorMessage(undefined);
    },
    [applyExecutionUpdates, nodes]
  );

  const createExecutionCallback = useCallback(
    (eagerStart: boolean) => {
      return (execution: WorkflowExecution) => {
        if (execution.id) {
          setCurrentExecutionId(execution.id);
        }

        if (statusRef.current === "cancelled") {
          return;
        }

        if (!eagerStart && statusRef.current === "idle") {
          resetNodeStates("executing");
        }

        setWorkflowStatus((currentStatus) => {
          let newStatus: WorkflowExecutionStatus;
          if (eagerStart) {
            if (
              currentStatus === "executing" &&
              execution.status === "submitted"
            ) {
              newStatus = currentStatus;
            } else {
              newStatus = execution.status;
            }
          } else if (currentStatus === "idle") {
            newStatus = "executing";
          } else if (
            currentStatus === "executing" &&
            execution.status === "submitted"
          ) {
            newStatus = currentStatus;
          } else {
            newStatus = execution.status;
          }
          statusRef.current = newStatus;
          return newStatus;
        });

        setWorkflowErrorMessage(execution.error);

        const executionUpdates: Record<string, NodeExecutionUpdate> = {};
        for (const nodeExecution of execution.nodeExecutions) {
          executionUpdates[nodeExecution.nodeId] = {
            state: nodeExecution.status,
            outputs: nodeExecution.outputs || {},
            error: nodeExecution.error,
          };
        }
        applyExecutionUpdates(executionUpdates);

        if (execution.status === "exhausted") {
          setErrorDialogOpen(true);
        }

        if (execution.status === "error") {
          const subscriptionErrorTypes: string[] = [];
          for (const ne of execution.nodeExecutions) {
            const parsed = parseSubscriptionRequiredError(ne.error);
            if (parsed) subscriptionErrorTypes.push(parsed.nodeType);
          }
          if (
            subscriptionErrorTypes.length === 0 &&
            isSubscriptionRequiredError(execution.error)
          ) {
            const parsed = parseSubscriptionRequiredError(execution.error);
            if (parsed) subscriptionErrorTypes.push(parsed.nodeType);
          }
          if (subscriptionErrorTypes.length > 0) {
            const seen = new Set<string>();
            const gated: NodeType[] = [];
            for (const typeId of subscriptionErrorTypes) {
              if (seen.has(typeId)) continue;
              seen.add(typeId);
              const nt = nodeTypeById.get(typeId);
              gated.push(
                nt ?? {
                  id: typeId,
                  type: typeId,
                  name: typeId,
                  icon: "sparkles",
                  tags: [],
                  inputs: [],
                  outputs: [],
                  subscription: true,
                }
              );
            }
            setUpgradeDialogGatedNodeTypes(gated);
            setUpgradeDialogVariant("post-failure");
            setUpgradeDialogOpen(true);
          }
        }
      };
    },
    [applyExecutionUpdates, resetNodeStates, nodeTypeById]
  );

  const handleExecute = useCallback(
    (triggerData?: unknown) => {
      if (!executeWorkflow) return null;

      resetNodeStates("executing");
      statusRef.current = "executing";
      setWorkflowStatus("executing");

      const executionCallback = createExecutionCallback(true);
      executionCallbackRef.current = executionCallback;

      return executeWorkflow(workflowId, executionCallback, triggerData);
    },
    [executeWorkflow, workflowId, resetNodeStates, createExecutionCallback]
  );

  const runWithConfig = useCallback(
    (config: WorkflowRunConfig) => {
      if (config.runtime !== workflowRuntime) {
        onPersistRuntime?.(config.runtime);
      }

      if (config.runAs === "manual") {
        const cleanup = handleExecute(undefined);
        if (cleanup) cleanupRef.current = cleanup;
        return;
      }

      executeRef.current = (triggerData) => {
        const cleanup = handleExecute(triggerData);
        if (cleanup) cleanupRef.current = cleanup;
      };

      const executionCallback = createExecutionCallback(false);
      executionCallbackRef.current = executionCallback;

      executeWorkflowWithForm(
        workflowId,
        executionCallback,
        nodes,
        nodeTypes,
        "http_request"
      );
    },
    [
      workflowRuntime,
      onPersistRuntime,
      handleExecute,
      createExecutionCallback,
      executeWorkflowWithForm,
      workflowId,
      nodes,
      nodeTypes,
    ]
  );

  const confirmRunConfig = useCallback(
    (config: WorkflowRunConfig) => {
      setRunConfigDialogVisible(false);
      deselectAll();

      if (billing && !isPro) {
        const gated = findGatedNodeTypes();
        if (gated.length > 0) {
          setUpgradeDialogGatedNodeTypes(gated);
          setUpgradeDialogVariant("preflight");
          setUpgradeDialogOpen(true);
          return;
        }
      }

      runWithConfig(config);
    },
    [deselectAll, billing, isPro, findGatedNodeTypes, runWithConfig]
  );

  const handleActionButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (workflowStatus === "idle") {
        deselectAll();
        setRunConfigDialogVisible(true);
      } else if (
        workflowStatus === "submitted" ||
        workflowStatus === "executing"
      ) {
        deselectAll();
        if (cleanupRef.current) {
          Promise.resolve(cleanupRef.current()).catch((error) =>
            console.error("Error during cleanup:", error)
          );
          cleanupRef.current = null;
        }
        statusRef.current = "cancelled";
        setWorkflowStatus("cancelled");
      } else {
        deselectAll();
        resetNodeStates();
        statusRef.current = "idle";
        setWorkflowStatus("idle");
      }
    },
    [workflowStatus, resetNodeStates, deselectAll]
  );

  return {
    workflowStatus,
    workflowErrorMessage,
    currentExecutionId,
    errorDialogOpen,
    setErrorDialogOpen,
    handleActionButtonClick,
    isRunConfigDialogVisible,
    setRunConfigDialogVisible,
    confirmRunConfig,
    isHttpRequestConfigDialogVisible,
    submitHttpRequestConfig,
    closeExecutionForm,
    executeRef,
    upgradeDialogOpen,
    setUpgradeDialogOpen,
    upgradeDialogVariant,
    upgradeDialogGatedNodeTypes,
  };
}
