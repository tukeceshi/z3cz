import type {
  WorkflowTrigger,
  WorkflowWithMetadata,
} from "@dafthunk/types";
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
import { WorkflowError } from "@/components/workflow/workflow-error";
import { CanvasMaintenanceProvider, useCanvasMaintenance } from "@/contexts/canvas-maintenance-context";
import { getCanvasMaintenanceFrozen } from "@/lib/canvas-maintenance-freeze";
import { useWorkflowMediaAddressCatalogInit } from "@/hooks/use-workflow-media-address-catalog-init";
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
  return (
    <CanvasMaintenanceProvider>
      <EditorPageCanvas />
    </CanvasMaintenanceProvider>
  );
}

function EditorPageCanvas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialViewportOneToOneRef = useRef(
    readInitialViewportOneToOne(location.state)
  );
  const { organization } = useAuth();
  const workflowReadOnly = !canEditWorkflows(organization);
  const { t } = useTranslation();
  const { refreshMaintenanceStatus } = useCanvasMaintenance();
  const appToast = useAppToast();
  const orgId = organization?.id || "";
  const { getOrgUrl } = useOrgUrl();
  const mediaAddressCatalogReady = useWorkflowMediaAddressCatalogInit(orgId, id);

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

  const {
    nodes: initialNodesForUI,
    edges: initialEdgesForUI,
    isInitializing: isWorkflowInitializing,
    isGraphReady,
    savingError: workflowSavingError,
    connectionError: workflowConnectionError,
    isWSConnected: _isWSConnected,
    workflowMetadata,
    editorViewport,
    editorViewportSyncRevision,
    isEditorViewportReady,
    generativeDefaults,
    handleNodesChange,
    handleEdgesChange,
    handleEditorViewportChange,
    handleEditorViewportGestureEnd,
    commitEditorViewport,
    handleGenerativeDefaultsChange,
    updateMetadata: wsUpdateMetadata,
  } = useEditableWorkflow({
    workflowId: id,
    nodeTypes: nodeTypes || [],
    fallbackWorkflow: httpWorkflowMetadata,
    httpMetadataLoaded,
    readOnly: workflowReadOnly,
    onWorkflowSync: () => {
      void refreshMaintenanceStatus();
    },
  });

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

  useEffect(() => {
    if (getCanvasMaintenanceFrozen()) {
      return;
    }
    if (workflowSavingError) {
      appToast.error("errors.workflowSaveFailed", {
        message: workflowSavingError,
      });
    }
  }, [workflowSavingError, appToast]);

  useEffect(() => {
    if (getCanvasMaintenanceFrozen()) {
      return;
    }
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
    !isEditorViewportReady ||
    !mediaAddressCatalogReady;

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
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkflowBuilder
          workflowId={id || ""}
          mode={workflowReadOnly ? "readonly" : "edit"}
          workflowTrigger={effectiveWorkflowMetadata.trigger as WorkflowTrigger}
          initialNodes={initialNodesForUI}
          initialEdges={initialEdgesForUI}
          nodeTypes={nodeTypes || []}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          createObjectUrl={createObjectUrl}
          workflowName={effectiveWorkflowMetadata.name || ""}
          workflowDescription={effectiveWorkflowMetadata.description}
          onWorkflowUpdate={handleWorkflowUpdate}
          orgId={orgId}
          workflowSettingsOpen={workflowSettingsOpen}
          onWorkflowSettingsOpenChange={setWorkflowSettingsOpen}
          workflowsListUrl={getOrgUrl("workflows")}
          onOpenWorkflowSettings={handleOpenWorkflowSettings}
          initialViewportOneToOne={initialViewportOneToOneRef.current}
          savedEditorViewport={editorViewport ?? null}
          editorViewportSyncRevision={editorViewportSyncRevision}
          onEditorViewportChange={handleEditorViewportChange}
          onEditorViewportGestureEnd={handleEditorViewportGestureEnd}
          onCommitEditorViewport={commitEditorViewport}
          generativeDefaults={generativeDefaults}
          onGenerativeDefaultsChange={handleGenerativeDefaultsChange}
          graphReady={isGraphReady}
        />
      </div>
      {!workflowReadOnly ? <CanvasThemeTip /> : null}
    </>
  );
}
