import { useState } from "react";
import { useParams } from "react-router";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  disableOrgInterfaceCloudAcceleration,
  useOrgCloudAccelerationInterfaces,
} from "@/services/cloud-acceleration-service";

export function OrganizationCloudAccelerationPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canAccessAiInterfaces) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.cloudAcceleration")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <OrganizationCloudAccelerationPageContent />;
}

function OrganizationCloudAccelerationPageContent() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const { t } = useTranslation();
  const toast = useAppToast();
  const [disablingId, setDisablingId] = useState<string | null>(null);

  usePageBreadcrumbs([{ label: t("pages.cloudAcceleration.title") }]);

  const {
    interfaceEntries,
    interfacesError,
    isInterfacesLoading,
    refreshInterfaces,
  } = useOrgCloudAccelerationInterfaces(organizationId);

  if (!organizationId) {
    return <InsetLoading />;
  }

  if (isInterfacesLoading) {
    return <InsetLoading title={t("pages.cloudAcceleration.title")} />;
  }

  if (interfacesError) {
    return (
      <InsetError
        title={t("pages.cloudAcceleration.title")}
        message={t("pages.cloudAcceleration.loadFailed")}
      />
    );
  }

  const handleDisableInterface = async (aiInterfaceId: string) => {
    setDisablingId(aiInterfaceId);
    try {
      await disableOrgInterfaceCloudAcceleration(organizationId, aiInterfaceId);
      await refreshInterfaces();
      toast.success(t("pages.cloudAcceleration.interfaceDisabled"));
    } catch {
      toast.error(t("pages.cloudAcceleration.interfaceDisableFailed"));
    } finally {
      setDisablingId(null);
    }
  };

  return (
    <InsetLayout title={t("pages.cloudAcceleration.title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
        <p className="text-sm text-muted-foreground">
          {t("pages.cloudAcceleration.description")}
        </p>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">
              {t("pages.cloudAcceleration.interfaceListTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("pages.cloudAcceleration.interfaceListHint")}
            </p>
          </div>

          {interfaceEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("pages.cloudAcceleration.interfaceListEmpty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.cloudAcceleration.interfaceName")}</TableHead>
                  <TableHead>{t("pages.cloudAcceleration.enabledAt")}</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {interfaceEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.interfaceName}</TableCell>
                    <TableCell>
                      {new Date(entry.enabledAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disablingId === entry.aiInterfaceId}
                        onClick={() => {
                          void handleDisableInterface(entry.aiInterfaceId);
                        }}
                      >
                        {t("pages.cloudAcceleration.disableInterface")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </InsetLayout>
  );
}
