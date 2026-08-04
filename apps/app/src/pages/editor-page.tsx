import type {
  WorkflowRuntime,
  WorkflowTrigger,
  WorkflowWithMetadata,
} from "@dafthunk/types";
import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { canEditWorkflows } from "@/utils/sub-account-permissions";
import { InsetLoading } from "@/components/inset-loading";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";
import { CanvasThemeTip } from "@/components/workflow/canvas-theme-tip";
import { readInitialViewportOneToOne } from "@/components/workflow/workflow-editor-navigation";
import { WorkflowEditorSidebarEffect } from "@/components/workflow/workflow-editor-sidebar-effect";
import { WorkflowError } from "@/components/workflow/workflow-error";
import type { WorkflowExecution } from "@/components/workflow/workflow-types";
import { useEditableWorkflow } from "@/hooks/use-editable-workflow";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useObjectService } from "@/services/object-service";
import { useNodeTypes } from "@/services/type-service";
import { getWorkflow } from "@/services/workflow-service";
import {
  clearPrefetchedWorkflowMetadata,
  consumePrefetchedWorkflowMetadata,
} from "@/utils/workflow-editor-prefetch";

export function EditorPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canViewWorkflows) {
    return (
      <OrgPermissionGate allowed={false} title={t("pages.workflows.title")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <EditorPageContent />;
}

function EditorPageContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialViewportOneToOneRef = useRef(
    readInitialViewportOneToOne(location.state)
  );
  const { organization } = useAuth();
  const workflowReadOnly = !canEditWorkflows(organization);
  const { t } = useTranslation();
  const appToast = useAppToast();
  const orgId = organization?.id || "";
  const { getOrgUrl } = useOrgUrl();

  const [httpWorkflowMetadata, setHttpWorkflowMetadata] =
    useState<WorkflowWithMetadata | null>(() => {
      if (!id || !orgId) {
        return null;
      }
      return consumePrefetchedWorkflowMetadata(id, orgId);
    });
  const [httpMetadataLoaded, setHttpMetadataLoaded] = useState(false);

  const [workflowSettingsOpen, setWorkflowSettingsOpen] = useState(false);

  const { nodeTypes, nodeTypesError, isNodeTypesLoading } = useNodeTypes(
    httpWorkflowMetadata?.schemeId,
    {
      revalidateOnFocus: false,
    }
  );

  const { createObjectUrl } = useObjectService();

  const executionCallbackRef = useRef<
    ((execution: WorkflowExecution) => void) | null
  >(null);

  const [latestExecution, setLatestExecution] =
    useState<WorkflowExecution | null>(null);

  const {
    nodes: initialNodesForUI,
    edges: initialEdgesForUI,
    isInitializing: isWorkflowInitializing,
    savingError: workflowSavingError,
    connectionError: workflowConnectionError,
    isWSConnected: _isWSConnected,
    workflowMetadata,
    editorViewport,
    isEditorViewportReady,
    generativeDefaults,
    handleNodesChange,
    handleEdgesChange,
    handleEditorViewportChange,
    commitEditorViewport,
    handleGenerativeDefaultsChange,
    executeWorkflow: wsExecuteWorkflow,
    updateMetadata: wsUpdateMetadata,
  } = useEditableWorkflow({
    workflowId: id,
    nodeTypes: nodeTypes || [],
    fallbackWorkflow: httpWorkflowMetadata,
    httpMetadataLoaded,
    onExecutionUpdate: (execution) => {
      if (executionCallbackRef.current) {
        executionCallbackRef.current(execution);
      } else {
        setLatestExecution(execution);
      }
    },
  });

  const executeWorkflowWrapper = useCallback(
    (
      _workflowId: string,
      onExecution: (execution: WorkflowExecution) => void,
      triggerData?: unknown
    ) => {
      executionCallbackRef.current = onExecution;
      wsExecuteWorkflow?.({
        parameters: triggerData as Record<string, unknown> | undefined,
      });

      return () => {
        executionCallbackRef.current = null;
      };
    },
    [wsExecuteWorkflow]
  );

  useEffect(() => {
    if (!id || !orgId) {
      setHttpWorkflowMetadata(null);
      setHttpMetadataLoaded(false);
      return;
    }

    const prefetched = consumePrefetchedWorkflowMetadata(id, orgId);
    setHttpWorkflowMetadata(prefetched);
    setHttpMetadataLoaded(false);

    let cancelled = false;

    const fetchWorkflowMetadata = async () => {
      try {
        const metadata = await getWorkflow(id, orgId);
        if (cancelled) {
          return;
        }
        setHttpWorkflowMetadata(metadata);
        clearPrefetchedWorkflowMetadata(id, orgId);
      } catch (error) {
        console.error("Failed to fetch workflow metadata:", error);
      } finally {
        if (!cancelled) {
          setHttpMetadataLoaded(true);
        }
      }
    };

    void fetchWorkflowMetadata();

    return () => {
      cancelled = true;
    };
  }, [id, orgId]);

  useEffect(() => {
    if (!readInitialViewportOneToOne(location.state)) {
      return;
    }
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null }
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const handleOpenWorkflowSettings = useCallback(() => {
    setWorkflowSettingsOpen(true);
  }, []);

  const handleWorkflowUpdate = useCallback(
    (name: string, description?: string) => {
      if (!id) return;

      wsUpdateMetadata?.({
        name,
        description,
      });
    },
    [id, wsUpdateMetadata]
  );

  const handlePersistRuntime = useCallback(
    (runtime: WorkflowRuntime) => {
      if (!id) return;
      wsUpdateMetadata?.({ runtime });
    },
    [id, wsUpdateMetadata]
  );

  useEffect(() => {
    if (workflowSavingError) {
      appToast.error("errors.workflowSaveFailed", {
        message: workflowSavingError,
      });
    }
  }, [workflowSavingError, appToast]);

  useEffect(() => {
    if (workflowConnectionError) {
      appToast.error("errors.connectionFailed", {
        message: workflowConnectionError,
      });
    }
  }, [workflowConnectionError, appToast]);

  if (nodeTypesError) {
    return (
      <WorkflowError
        message={nodeTypesError.message || t("errors.nodeTypesLoadFailed")}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const effectiveWorkflowMetadata =
    workflowMetadata ??
    (httpWorkflowMetadata
      ? {
          id: httpWorkflowMetadata.id,
          name: httpWorkflowMetadata.name,
          description: httpWorkflowMetadata.description,
          schemeId: httpWorkflowMetadata.schemeId,
          trigger: httpWorkflowMetadata.trigger,
          runtime: httpWorkflowMetadata.runtime,
        }
      : null);

  const isLoading =
    isNodeTypesLoading ||
    isWorkflowInitializing ||
    !effectiveWorkflowMetadata ||
    !httpMetadataLoaded ||
    !isEditorViewportReady;

  if (isLoading) {
    return <InsetLoading />;
  }

  if (!effectiveWorkflowMetadata) {
    return (
      <WorkflowError
        message={t("errors.workflowNotFound", { id: id ?? "" })}
        onRetry={() => navigate(getOrgUrl("workflows"))}
      />
    );
  }

  return (
    <ReactFlowProvider>
      <WorkflowEditorSidebarEffect />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkflowBuilder
          workflowId={id || ""}
          mode={workflowReadOnly ? "readonly" : "edit"}
          workflowTrigger={effectiveWorkflowMetadata.trigger as WorkflowTrigger}
          workflowRuntime={effectiveWorkflowMetadata.runtime}
          initialNodes={initialNodesForUI}
          initialEdges={initialEdgesForUI}
          nodeTypes={nodeTypes || []}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          executeWorkflow={executeWorkflowWrapper}
          initialWorkflowExecution={latestExecution || undefined}
          createObjectUrl={createObjectUrl}
          workflowName={effectiveWorkflowMetadata.name || ""}
          workflowDescription={effectiveWorkflowMetadata.description}
          onWorkflowUpdate={handleWorkflowUpdate}
          onPersistRuntime={handlePersistRuntime}
          orgId={orgId}
          wsExecuteWorkflow={wsExecuteWorkflow}
          workflowSettingsOpen={workflowSettingsOpen}
          onWorkflowSettingsOpenChange={setWorkflowSettingsOpen}
          workflowsListUrl={getOrgUrl("workflows")}
          onOpenWorkflowSettings={handleOpenWorkflowSettings}
          initialViewportOneToOne={initialViewportOneToOneRef.current}
          savedEditorViewport={editorViewport ?? null}
          onEditorViewportChange={handleEditorViewportChange}
          onCommitEditorViewport={commitEditorViewport}
          generativeDefaults={generativeDefaults}
          onGenerativeDefaultsChange={handleGenerativeDefaultsChange}
        />
      </div>
      {!workflowReadOnly ? <CanvasThemeTip /> : null}
    </ReactFlowProvider>
  );
}
