import type {
  WorkflowRuntime,
  WorkflowTrigger,
  WorkflowWithMetadata,
} from "@dafthunk/types";
import { ReactFlowProvider } from "@xyflow/react";
import Settings from "lucide-react/icons/settings";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { canEditWorkflows } from "@/utils/sub-account-permissions";
import { InsetLoading } from "@/components/inset-loading";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/hooks/use-app-toast";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";
import { readInitialViewportOneToOne } from "@/components/workflow/workflow-editor-navigation";
import { WorkflowEditorSidebarEffect } from "@/components/workflow/workflow-editor-sidebar-effect";
import { WorkflowError } from "@/components/workflow/workflow-error";
import type { WorkflowExecution } from "@/components/workflow/workflow-types";
import { useEditableWorkflow } from "@/hooks/use-editable-workflow";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
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
    handleNodesChange,
    handleEdgesChange,
    handleEditorViewportChange,
    executeWorkflow: wsExecuteWorkflow,
    updateMetadata: wsUpdateMetadata,
  } = useEditableWorkflow({
    workflowId: id,
    nodeTypes: nodeTypes || [],
    fallbackWorkflow: httpWorkflowMetadata,
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
    const fetchWorkflowMetadata = async () => {
      if (!id || !orgId) return;
      try {
        const metadata = await getWorkflow(id, orgId);
        setHttpWorkflowMetadata(metadata);
        clearPrefetchedWorkflowMetadata(id, orgId);
      } catch (error) {
        console.error("Failed to fetch workflow metadata:", error);
      }
    };
    fetchWorkflowMetadata();
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

  const workflowSettingsButton = useMemo(
    () =>
      workflowReadOnly ? null : (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        aria-label={t("pages.editor.workflowSettings")}
        title={t("pages.editor.workflowSettings")}
        onClick={() => setWorkflowSettingsOpen(true)}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
      ),
    [t, workflowReadOnly]
  );

  usePageBreadcrumbs(
    [
      { label: t("pages.workflows.title"), to: getOrgUrl("workflows") },
      {
        label:
          httpWorkflowMetadata?.name ||
          workflowMetadata?.name ||
          t("pages.editor.defaultName"),
        trailing: workflowSettingsButton,
      },
    ],
    [
      httpWorkflowMetadata?.name,
      workflowMetadata?.name,
      workflowSettingsButton,
      getOrgUrl,
      t,
    ]
  );

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
    (isWorkflowInitializing && !effectiveWorkflowMetadata) ||
    editorViewport === undefined;

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
          initialViewportOneToOne={initialViewportOneToOneRef.current}
          savedEditorViewport={editorViewport ?? null}
          onEditorViewportChange={handleEditorViewportChange}
        />
      </div>
    </ReactFlowProvider>
  );
}
