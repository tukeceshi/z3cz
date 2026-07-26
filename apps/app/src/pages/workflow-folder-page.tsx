import { OrgPermissionGate } from "@/components/org-permission-gate";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { WorkflowLibraryView } from "@/components/workflow/workflow-library-view";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useParams } from "react-router";

export function WorkflowFolderPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canViewWorkflows) {
    return (
      <OrgPermissionGate allowed={false} title={t("pages.workflows.title")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <WorkflowFolderPageContent />;
}

function WorkflowFolderPageContent() {
  const { t } = useTranslation();
  const { folderId } = useParams<{ folderId: string }>();

  return (
    <InsetLayout
      title={t("pages.workflows.title")}
      childrenClassName="flex flex-col h-full"
    >
      <WorkflowLibraryView folderId={folderId} />
    </InsetLayout>
  );
}
