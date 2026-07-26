import type { PersistWorker, PersistWorkerDeployStatus } from "@dafthunk/types";
import { useEffect, useState } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  bootstrapAdminPersistWorker,
  deleteAdminPersistWorker,
  redeployAdminPersistWorker,
  updateAdminPersistWorkerPoolSettings,
  useAdminPersistWorkers,
} from "@/services/persist-worker-service";

interface BootstrapFormState {
  name: string;
  host: string;
  sshPort: number;
  sshUsername: string;
  sshPassword: string;
  maxConcurrentJobs: number;
  apiBaseUrl: string;
}

const emptyBootstrapForm = (): BootstrapFormState => ({
  name: "",
  host: "",
  sshPort: 22,
  sshUsername: "root",
  sshPassword: "",
  maxConcurrentJobs: 1,
  apiBaseUrl: "",
});

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function deployStatusVariant(
  status: PersistWorkerDeployStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "deploying":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function AdminPersistWorkersPage() {
  const { workers, settings, workersError, isWorkersLoading, refreshWorkers } =
    useAdminPersistWorkers();
  const [poolEnabled, setPoolEnabled] = useState(false);
  const [isUpdatingPool, setIsUpdatingPool] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deployLogOpen, setDeployLogOpen] = useState(false);
  const [deployLog, setDeployLog] = useState("");
  const [form, setForm] = useState<BootstrapFormState>(emptyBootstrapForm);
  const [isSaving, setIsSaving] = useState(false);
  const [redeployWorker, setRedeployWorker] = useState<PersistWorker | null>(null);
  const [redeployPassword, setRedeployPassword] = useState("");
  const [isRedeploying, setIsRedeploying] = useState(false);

  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();
  const appToast = useAppToast();

  useEffect(() => {
    setPoolEnabled(settings.enabled);
  }, [settings.enabled]);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("sidebar.persistWorkers") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handlePoolToggle = async (enabled: boolean) => {
    setIsUpdatingPool(true);
    try {
      await updateAdminPersistWorkerPoolSettings(enabled);
      setPoolEnabled(enabled);
      await refreshWorkers();
      appToast.success("admin.persistWorkers.poolUpdated");
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.poolUpdateFailed")
      );
    } finally {
      setIsUpdatingPool(false);
    }
  };

  const handleOpenBootstrap = () => {
    setForm(emptyBootstrapForm());
    setDialogOpen(true);
  };

  const handleBootstrap = async () => {
    setIsSaving(true);
    try {
      const result = await bootstrapAdminPersistWorker({
        name: form.name.trim(),
        host: form.host.trim(),
        sshPort: form.sshPort,
        sshUsername: form.sshUsername.trim(),
        sshPassword: form.sshPassword,
        maxConcurrentJobs: form.maxConcurrentJobs,
        ...(form.apiBaseUrl.trim()
          ? { apiBaseUrl: form.apiBaseUrl.trim() }
          : {}),
      });

      setDeployLog(result.deployLog);
      setDeployLogOpen(true);
      setDialogOpen(false);
      appToast.success("admin.persistWorkers.bootstrapSuccess");
      await refreshWorkers();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.bootstrapFailed")
      );
      await refreshWorkers();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRedeploy = async () => {
    if (!redeployWorker) {
      return;
    }

    setIsRedeploying(true);
    try {
      const result = await redeployAdminPersistWorker(redeployWorker.id, {
        sshPassword: redeployPassword,
      });
      setDeployLog(result.deployLog);
      setDeployLogOpen(true);
      setRedeployWorker(null);
      setRedeployPassword("");
      appToast.success("admin.persistWorkers.redeploySuccess");
      await refreshWorkers();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.redeployFailed")
      );
      await refreshWorkers();
    } finally {
      setIsRedeploying(false);
    }
  };

  const handleDelete = async (worker: PersistWorker) => {
    if (
      !window.confirm(
        t("admin.persistWorkers.deleteConfirm", { name: worker.name })
      )
    ) {
      return;
    }

    try {
      await deleteAdminPersistWorker(worker.id);
      appToast.success("admin.persistWorkers.deleted");
      await refreshWorkers();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.deleteFailed")
      );
    }
  };

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
    <InsetLayout
      title={t("admin.persistWorkers.title")}
      titleRight={
        <Button onClick={handleOpenBootstrap}>
          {t("admin.persistWorkers.initialize")}
        </Button>
      }
    >
      <div className="mb-6 flex items-center justify-between rounded-lg border bg-background p-4">
        <div>
          <div className="font-medium">{t("admin.persistWorkers.poolToggle")}</div>
          <p className="text-sm text-muted-foreground">
            {t("admin.persistWorkers.poolDescription")}
          </p>
        </div>
        <Switch
          checked={poolEnabled}
          disabled={isUpdatingPool}
          onCheckedChange={handlePoolToggle}
        />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {t("admin.persistWorkers.description")}
      </p>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.persistWorkers.columns.name")}</TableHead>
              <TableHead>{t("admin.persistWorkers.columns.host")}</TableHead>
              <TableHead>{t("admin.persistWorkers.columns.capacity")}</TableHead>
              <TableHead>{t("admin.persistWorkers.columns.deployStatus")}</TableHead>
              <TableHead>{t("admin.persistWorkers.columns.heartbeat")}</TableHead>
              <TableHead className="text-right">
                {t("admin.persistWorkers.columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  {t("admin.persistWorkers.empty")}
                </TableCell>
              </TableRow>
            ) : (
              workers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell>
                    <div className="font-medium">{worker.name}</div>
                    <div className="text-xs text-muted-foreground">{worker.id}</div>
                  </TableCell>
                  <TableCell>
                    {worker.host ? (
                      <div>
                        <div>{worker.host}</div>
                        <div className="text-xs text-muted-foreground">
                          {worker.sshUsername}@{worker.sshPort}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {worker.activeJobCount} / {worker.maxConcurrentJobs}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={deployStatusVariant(worker.deployStatus)}>
                        {t(`admin.persistWorkers.deployStatus.${worker.deployStatus}`)}
                      </Badge>
                      {worker.deployError ? (
                        <div className="max-w-xs truncate text-xs text-destructive">
                          {worker.deployError}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatTimestamp(worker.lastHeartbeatAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {worker.host ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRedeployWorker(worker);
                            setRedeployPassword("");
                          }}
                        >
                          {t("admin.persistWorkers.redeploy")}
                        </Button>
                      ) : null}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(worker)}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.persistWorkers.initialize")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {t("admin.persistWorkers.initializeDescription")}
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="worker-name">{t("admin.persistWorkers.form.name")}</Label>
              <Input
                id="worker-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t("admin.persistWorkers.form.namePlaceholder")}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="worker-host">{t("admin.persistWorkers.form.host")}</Label>
                <Input
                  id="worker-host"
                  value={form.host}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, host: event.target.value }))
                  }
                  placeholder="203.0.113.10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-port">{t("admin.persistWorkers.form.sshPort")}</Label>
                <Input
                  id="worker-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.sshPort}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sshPort: Number(event.target.value) || 22,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="worker-username">
                  {t("admin.persistWorkers.form.sshUsername")}
                </Label>
                <Input
                  id="worker-username"
                  value={form.sshUsername}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sshUsername: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-password">
                  {t("admin.persistWorkers.form.sshPassword")}
                </Label>
                <Input
                  id="worker-password"
                  type="password"
                  value={form.sshPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sshPassword: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="worker-capacity">
                {t("admin.persistWorkers.form.maxConcurrentJobs")}
              </Label>
              <Input
                id="worker-capacity"
                type="number"
                min={1}
                max={32}
                value={form.maxConcurrentJobs}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxConcurrentJobs: Number(event.target.value) || 1,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="worker-api-url">
                {t("admin.persistWorkers.form.apiBaseUrl")}
              </Label>
              <Input
                id="worker-api-url"
                value={form.apiBaseUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apiBaseUrl: event.target.value,
                  }))
                }
                placeholder={t("admin.persistWorkers.form.apiBaseUrlPlaceholder")}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={
                  isSaving ||
                  !form.name.trim() ||
                  !form.host.trim() ||
                  !form.sshUsername.trim() ||
                  !form.sshPassword
                }
                onClick={handleBootstrap}
              >
                {t("admin.persistWorkers.initializeSubmit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(redeployWorker)}
        onOpenChange={(open) => {
          if (!open) {
            setRedeployWorker(null);
            setRedeployPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.persistWorkers.redeploy")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("admin.persistWorkers.redeployDescription", {
              name: redeployWorker?.name ?? "",
            })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="redeploy-password">
              {t("admin.persistWorkers.form.sshPassword")}
            </Label>
            <Input
              id="redeploy-password"
              type="password"
              value={redeployPassword}
              onChange={(event) => setRedeployPassword(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRedeployWorker(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={isRedeploying || !redeployPassword}
              onClick={handleRedeploy}
            >
              {t("admin.persistWorkers.redeploySubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deployLogOpen} onOpenChange={setDeployLogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin.persistWorkers.deployLogTitle")}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
            {deployLog || t("admin.persistWorkers.deployLogEmpty")}
          </pre>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
