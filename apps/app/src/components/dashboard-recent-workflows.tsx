import type { DashboardRecentWorkflow } from "@dafthunk/types";
import { WORKFLOW_SCHEME_BASIC_CANVAS_ID } from "@dafthunk/types";
import Wand from "lucide-react/icons/wand";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { createWorkflowEditorLocationState } from "@/components/workflow/workflow-editor-navigation";
import { WorkflowLibraryPreview } from "@/components/workflow/workflow-library-preview";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useAppToast } from "@/hooks/use-app-toast";
import { createWorkflow } from "@/services/workflow-service";
import { formatRelativeDate } from "@/utils/date";
import { prefetchWorkflowEditorSession } from "@/utils/workflow-editor-prefetch";

interface DashboardRecentWorkflowsProps {
  readonly workflows: readonly DashboardRecentWorkflow[];
}

export function DashboardRecentWorkflows({
  workflows,
}: DashboardRecentWorkflowsProps) {
  const { t } = useTranslation();
  const perms = useOrgPermissions();
  const { getOrgUrl } = useOrgUrl();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t("pages.dashboard.recentWorkflows.title")}
        </h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to={getOrgUrl("workflows")}>
            {t("pages.dashboard.recentWorkflows.viewAll")}
          </Link>
        </Button>
      </div>

      {workflows.length === 0 && !perms.canEditWorkflows ? (
        <div className="py-12 text-center text-muted-foreground">
          <Wand className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-sm">{t("pages.dashboard.recentWorkflows.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {perms.canEditWorkflows ? <DashboardCreateCard /> : null}
          {workflows.map((workflow) => (
            <DashboardWorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardCreateCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appToast = useAppToast();
  const { organization } = useAuth();
  const orgId = organization?.id ?? "";
  const { getOrgUrl } = useOrgUrl();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!orgId || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const newWorkflow = await createWorkflow(
        {
          name: t("pages.workflows.defaultName"),
          schemeId: WORKFLOW_SCHEME_BASIC_CANVAS_ID,
          trigger: "manual",
          runtime: "workflow",
          folderId: null,
          nodes: [],
          edges: [],
        },
        orgId
      );
      prefetchWorkflowEditorSession(
        newWorkflow.id,
        orgId,
        WORKFLOW_SCHEME_BASIC_CANVAS_ID
      );
      navigate(getOrgUrl(`workflows/${newWorkflow.id}`), {
        state: createWorkflowEditorLocationState(),
      });
    } catch (error) {
      console.error("Failed to create workflow:", error);
      appToast.error("errors.workflowUpdateFailed");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={isCreating ? "pointer-events-none opacity-60" : undefined}>
      <button
        type="button"
        onClick={handleCreate}
        disabled={isCreating}
        className="w-full text-left transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
      >
        <WorkflowLibraryPreview
          variant="create"
          orgId=""
          fallbackLabel={t("pages.workflows.createCardTitle")}
        />
      </button>
      <p className="mt-2 truncate text-sm text-muted-foreground">
        {t("pages.workflows.createCardCaption")}
      </p>
    </div>
  );
}

function DashboardWorkflowCard({
  workflow,
}: {
  workflow: DashboardRecentWorkflow;
}) {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const orgId = organization?.id ?? "";
  const { getOrgUrl } = useOrgUrl();

  const handleOpen = () => {
    navigate(getOrgUrl(`workflows/${workflow.id}`));
  };

  const handlePrefetch = () => {
    prefetchWorkflowEditorSession(workflow.id, orgId);
  };

  return (
    <div
      className="group"
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="w-full text-left transition-opacity hover:opacity-95"
      >
        <WorkflowLibraryPreview
          orgId={orgId}
          coverObjectId={workflow.coverObjectId}
          coverMimeType={workflow.coverMimeType}
          fallbackLabel={workflow.name || t("pages.workflows.untitled")}
          variant="workflow"
        />
      </button>
      <p className="mt-2 truncate text-sm font-medium">
        {workflow.name || t("pages.workflows.untitled")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("pages.workflows.updated", {
          date: formatRelativeDate(workflow.updatedAt, locale),
        })}
      </p>
    </div>
  );
}
