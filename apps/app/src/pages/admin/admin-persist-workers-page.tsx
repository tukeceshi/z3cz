import { useEffect } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { PersistWorkersPanel } from "@/components/persist-workers-panel";
import {
  bootstrapAdminPersistWorker,
  deleteAdminPersistWorker,
  redeployAdminPersistWorker,
  useAdminPersistWorkers,
} from "@/services/persist-worker-service";

export function AdminPersistWorkersPage() {
  const { workers, workersError, isWorkersLoading, refreshWorkers } =
    useAdminPersistWorkers();

  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("sidebar.persistWorkers") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  if (isWorkersLoading) {
    return <InsetLoading title={t("admin.persistWorkers.title")} />;
  }

  if (workersError) {
    return (
      <InsetError
        title={t("admin.persistWorkers.title")}
        errorMessage={t("admin.persistWorkers.loadFailed")}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.persistWorkers.title")}>
      <PersistWorkersPanel
        idPrefix="admin_persist_worker"
        workers={workers}
        onBootstrap={bootstrapAdminPersistWorker}
        onRedeploy={redeployAdminPersistWorker}
        onDelete={deleteAdminPersistWorker}
        onRefresh={refreshWorkers}
      />
    </InsetLayout>
  );
}
