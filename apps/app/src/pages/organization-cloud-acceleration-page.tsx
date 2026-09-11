import { useState } from "react";
import { useParams } from "react-router";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { PersistWorkersPanel } from "@/components/persist-workers-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  disableOrgInterfaceCloudAcceleration,
  enableAlwaysOrgInterfaceCloudAcceleration,
  setOrgInterfaceApiForwarding,
  useOrgApiForwardingAvailable,
  useOrgApiForwardingInterfaces,
  useOrgCloudAccelerationAvailable,
  useOrgCloudAccelerationInterfaces,
} from "@/services/cloud-acceleration-service";
import {
  bootstrapOrgPersistWorker,
  deleteOrgPersistWorker,
  redeployOrgPersistWorker,
  useOrgPersistWorkers,
} from "@/services/persist-worker-service";

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
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [forwardingId, setForwardingId] = useState<string | null>(null);

  usePageBreadcrumbs([{ label: t("pages.cloudAcceleration.title") }]);

  const {
    interfaceEntries,
    interfacesError,
    isInterfacesLoading,
    refreshInterfaces,
  } = useOrgCloudAccelerationInterfaces(organizationId);
  const {
    availableDownloadInterfaces,
    availableDownloadError,
    isAvailableDownloadLoading,
    refreshAvailableDownload,
  } = useOrgCloudAccelerationAvailable(organizationId);
  const { workers, workersError, isWorkersLoading, refreshWorkers } =
    useOrgPersistWorkers(organizationId);
  const {
    forwardingInterfaces,
    forwardingError,
    isForwardingLoading,
    refreshForwarding,
  } = useOrgApiForwardingInterfaces(organizationId);
  const {
    availableInterfaces,
    availableError,
    isAvailableLoading,
    refreshAvailable,
  } = useOrgApiForwardingAvailable(organizationId);

  if (!organizationId) {
    return <InsetLoading />;
  }

  if (isInterfacesLoading || isWorkersLoading || isForwardingLoading) {
    return <InsetLoading title={t("pages.cloudAcceleration.title")} />;
  }

  if (interfacesError || workersError || forwardingError) {
    return (
      <InsetError
        title={t("pages.cloudAcceleration.title")}
        errorMessage={t("pages.cloudAcceleration.loadFailed")}
      />
    );
  }

  const handleAddForwarding = async (aiInterfaceId: string) => {
    setForwardingId(aiInterfaceId);
    try {
      await setOrgInterfaceApiForwarding(organizationId, aiInterfaceId, true);
      await Promise.all([refreshForwarding(), refreshAvailable()]);
      toast.success("pages.cloudAcceleration.apiForwardingAdded");
    } catch {
      toast.error("pages.cloudAcceleration.apiForwardingUpdateFailed");
    } finally {
      setForwardingId(null);
    }
  };

  const handleRemoveForwarding = async (aiInterfaceId: string) => {
    setForwardingId(aiInterfaceId);
    try {
      await setOrgInterfaceApiForwarding(organizationId, aiInterfaceId, false);
      await Promise.all([refreshForwarding(), refreshAvailable()]);
      toast.success("pages.cloudAcceleration.apiForwardingRemoved");
    } catch {
      toast.error("pages.cloudAcceleration.apiForwardingUpdateFailed");
    } finally {
      setForwardingId(null);
    }
  };

  const handleAddDownloadInterface = async (aiInterfaceId: string) => {
    setDownloadId(aiInterfaceId);
    try {
      await enableAlwaysOrgInterfaceCloudAcceleration(
        organizationId,
        aiInterfaceId
      );
      await Promise.all([refreshInterfaces(), refreshAvailableDownload()]);
      toast.success("pages.cloudAcceleration.interfaceListAdded");
    } catch {
      toast.error("pages.cloudAcceleration.requestFailed");
    } finally {
      setDownloadId(null);
    }
  };

  const handleRemoveDownloadInterface = async (aiInterfaceId: string) => {
    setDownloadId(aiInterfaceId);
    try {
      await disableOrgInterfaceCloudAcceleration(organizationId, aiInterfaceId);
      await Promise.all([refreshInterfaces(), refreshAvailableDownload()]);
      toast.success("pages.cloudAcceleration.interfaceListRemoved");
    } catch {
      toast.error("pages.cloudAcceleration.requestFailed");
    } finally {
      setDownloadId(null);
    }
  };

  return (
    <InsetLayout title={t("pages.cloudAcceleration.title")}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
        <p className="text-sm text-muted-foreground">
          {t("pages.cloudAcceleration.description")}
        </p>

        <PersistWorkersPanel
          idPrefix="org_cloud_accel"
          title={t("pages.cloudAcceleration.workersTitle")}
          description={t("pages.cloudAcceleration.workersHint")}
          workers={workers}
          onBootstrap={(input) =>
            bootstrapOrgPersistWorker(organizationId, input)
          }
          onRedeploy={(id, input) =>
            redeployOrgPersistWorker(organizationId, id, input)
          }
          onDelete={(id) => deleteOrgPersistWorker(organizationId, id)}
          onRefresh={refreshWorkers}
        />

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">
                {t("pages.cloudAcceleration.apiForwardingTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("pages.cloudAcceleration.apiForwardingHint")}
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0"
              onClick={() => {
                setAddDialogOpen(true);
              }}
            >
              {t("pages.cloudAcceleration.apiForwardingAdd")}
            </Button>
          </div>

          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("pages.cloudAcceleration.interfaceName")}
                  </TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {forwardingInterfaces.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t("pages.cloudAcceleration.apiForwardingEmpty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  forwardingInterfaces.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={forwardingId === entry.id}
                          onClick={() => {
                            void handleRemoveForwarding(entry.id);
                          }}
                        >
                          {t("pages.cloudAcceleration.apiForwardingRemove")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("pages.cloudAcceleration.apiForwardingAddTitle")}
              </DialogTitle>
            </DialogHeader>
            {isAvailableLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : availableError ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.cloudAcceleration.loadFailed")}
              </p>
            ) : availableInterfaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.cloudAcceleration.apiForwardingAddEmpty")}
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {availableInterfaces.map((entry) => (
                  <Button
                    key={entry.id}
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    disabled={forwardingId === entry.id}
                    onClick={() => {
                      void handleAddForwarding(entry.id);
                    }}
                  >
                    {entry.name}
                  </Button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">
                {t("pages.cloudAcceleration.interfaceListTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("pages.cloudAcceleration.interfaceListHint")}
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0"
              onClick={() => {
                setDownloadDialogOpen(true);
              }}
            >
              {t("pages.cloudAcceleration.interfaceListAdd")}
            </Button>
          </div>

          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("pages.cloudAcceleration.interfaceName")}
                  </TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {interfaceEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t("pages.cloudAcceleration.interfaceListEmpty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  interfaceEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.interfaceName}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={downloadId === entry.aiInterfaceId}
                          onClick={() => {
                            void handleRemoveDownloadInterface(
                              entry.aiInterfaceId
                            );
                          }}
                        >
                          {t("pages.cloudAcceleration.interfaceListRemove")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("pages.cloudAcceleration.interfaceListAddTitle")}
              </DialogTitle>
            </DialogHeader>
            {isAvailableDownloadLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : availableDownloadError ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.cloudAcceleration.loadFailed")}
              </p>
            ) : availableDownloadInterfaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.cloudAcceleration.interfaceListAddEmpty")}
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {availableDownloadInterfaces.map((entry) => (
                  <Button
                    key={entry.id}
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    disabled={downloadId === entry.id}
                    onClick={() => {
                      void handleAddDownloadInterface(entry.id);
                    }}
                  >
                    {entry.name}
                  </Button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </InsetLayout>
  );
}
