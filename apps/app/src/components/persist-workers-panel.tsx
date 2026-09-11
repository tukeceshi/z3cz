import type {
  BootstrapPersistWorkerRequest,
  PersistWorker,
  PersistWorkerDeployStatus,
  PersistWorkerPlatformSummary,
  RedeployPersistWorkerRequest,
} from "@dafthunk/types";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  CredentialPlainInput,
  CredentialSecretInput,
} from "@/components/credential-secret-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/utils/utils";

export interface PersistWorkerBootstrapFormState {
  name: string;
  host: string;
  sshPort: number;
  sshUsername: string;
  sshPassword: string;
  maxConcurrentJobs: number;
}

export const emptyPersistWorkerBootstrapForm =
  (): PersistWorkerBootstrapFormState => ({
    name: "",
    host: "",
    sshPort: 22,
    sshUsername: "",
    sshPassword: "",
    maxConcurrentJobs: 1,
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

interface PersistWorkersPanelProps {
  readonly idPrefix: string;
  readonly title?: string;
  readonly description?: string;
  readonly workers: readonly PersistWorker[];
  readonly platform?: PersistWorkerPlatformSummary | null;
  readonly onBootstrap: (
    input: BootstrapPersistWorkerRequest
  ) => Promise<{ readonly deployLog: string }>;
  readonly onRedeploy: (
    id: string,
    input: RedeployPersistWorkerRequest
  ) => Promise<{ readonly deployLog: string }>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onRefresh: () => Promise<unknown>;
}

export function PersistWorkersPanel({
  idPrefix,
  title,
  description,
  workers,
  platform,
  onBootstrap,
  onRedeploy,
  onDelete,
  onRefresh,
}: PersistWorkersPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deployLogOpen, setDeployLogOpen] = useState(false);
  const [deployLog, setDeployLog] = useState("");
  const [form, setForm] = useState<PersistWorkerBootstrapFormState>(
    emptyPersistWorkerBootstrapForm()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [redeployWorker, setRedeployWorker] = useState<PersistWorker | null>(
    null
  );
  const [redeployPassword, setRedeployPassword] = useState("");
  const [isRedeploying, setIsRedeploying] = useState(false);

  const { t } = useTranslation();
  const appToast = useAppToast();

  const handleOpenBootstrap = () => {
    setForm(emptyPersistWorkerBootstrapForm());
    setDialogOpen(true);
  };

  const handleBootstrap = async () => {
    setIsSaving(true);
    try {
      const result = await onBootstrap({
        name: form.name.trim(),
        host: form.host.trim(),
        sshPort: form.sshPort,
        sshUsername: form.sshUsername.trim(),
        sshPassword: form.sshPassword,
        maxConcurrentJobs: form.maxConcurrentJobs,
      });

      setDeployLog(result.deployLog);
      setDeployLogOpen(true);
      setDialogOpen(false);
      appToast.success("admin.persistWorkers.bootstrapSuccess");
      await onRefresh();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.bootstrapFailed")
      );
      await onRefresh();
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
      const result = await onRedeploy(redeployWorker.id, {
        sshPassword: redeployPassword,
      });
      setDeployLog(result.deployLog);
      setDeployLogOpen(true);
      setRedeployWorker(null);
      setRedeployPassword("");
      appToast.success("admin.persistWorkers.redeploySuccess");
      await onRefresh();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.redeployFailed")
      );
      await onRefresh();
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
      await onDelete(worker.id);
      appToast.success("admin.persistWorkers.deleted");
      await onRefresh();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("admin.persistWorkers.deleteFailed")
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {title ? (
            <h2 className="text-sm font-medium">{title}</h2>
          ) : null}
          <p
            className={cn(
              "text-muted-foreground",
              title ? "text-xs" : "text-sm"
            )}
          >
            {description ?? t("admin.persistWorkers.description")}
          </p>
        </div>
        <Button type="button" className="shrink-0" onClick={handleOpenBootstrap}>
          {t("admin.persistWorkers.add")}
        </Button>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.persistWorkers.columns.name")}</TableHead>
              <TableHead>{t("admin.persistWorkers.columns.host")}</TableHead>
              <TableHead>{t("admin.persistWorkers.columns.capacity")}</TableHead>
              <TableHead>
                {t("admin.persistWorkers.columns.deployStatus")}
              </TableHead>
              <TableHead>{t("admin.persistWorkers.columns.heartbeat")}</TableHead>
              <TableHead className="text-right">
                {t("admin.persistWorkers.columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 && !platform ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t("admin.persistWorkers.empty")}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {platform ? (
                  <TableRow>
                    <TableCell>
                      <div className="font-medium">
                        {t("pages.cloudAcceleration.platformWorkerName")}
                      </div>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <Badge variant={deployStatusVariant(platform.deployStatus)}>
                        {t(
                          `admin.persistWorkers.deployStatus.${platform.deployStatus}`
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(platform.lastHeartbeatAt)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ) : null}
                {workers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell>
                      <div className="font-medium">{worker.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {worker.id}
                      </div>
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
                          {t(
                            `admin.persistWorkers.deployStatus.${worker.deployStatus}`
                          )}
                        </Badge>
                        {worker.deployError ? (
                          <div className="max-w-xs truncate text-xs text-destructive">
                            {worker.deployError}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(worker.lastHeartbeatAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {worker.host ? (
                          <Button
                            type="button"
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
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            void handleDelete(worker);
                          }}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.persistWorkers.add")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {t("admin.persistWorkers.addDescription")}
          </p>

          <form
            autoComplete="off"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleBootstrap();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-name`}>
                {t("admin.persistWorkers.form.name")}
              </Label>
              <CredentialPlainInput
                id={`${idPrefix}-name`}
                name={`${idPrefix}_name`}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t("admin.persistWorkers.form.namePlaceholder")}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor={`${idPrefix}-host`}>
                  {t("admin.persistWorkers.form.host")}
                </Label>
                <CredentialPlainInput
                  id={`${idPrefix}-host`}
                  name={`${idPrefix}_host`}
                  value={form.host}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      host: event.target.value,
                    }))
                  }
                  placeholder="203.0.113.10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-port`}>
                  {t("admin.persistWorkers.form.sshPort")}
                </Label>
                <CredentialPlainInput
                  id={`${idPrefix}-port`}
                  name={`${idPrefix}_ssh_port`}
                  inputMode="numeric"
                  value={String(form.sshPort)}
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
                <Label htmlFor={`${idPrefix}-username`}>
                  {t("admin.persistWorkers.form.sshUsername")}
                </Label>
                <CredentialPlainInput
                  id={`${idPrefix}-username`}
                  name={`${idPrefix}_ssh_username`}
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
                <Label htmlFor={`${idPrefix}-password`}>
                  {t("admin.persistWorkers.form.sshPassword")}
                </Label>
                <CredentialSecretInput
                  id={`${idPrefix}-password`}
                  name={`${idPrefix}_ssh_password`}
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
              <Label htmlFor={`${idPrefix}-capacity`}>
                {t("admin.persistWorkers.form.maxConcurrentJobs")}
              </Label>
              <CredentialPlainInput
                id={`${idPrefix}-capacity`}
                name={`${idPrefix}_max_concurrent_jobs`}
                inputMode="numeric"
                value={String(form.maxConcurrentJobs)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxConcurrentJobs: Number(event.target.value) || 1,
                  }))
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !form.name.trim() ||
                  !form.host.trim() ||
                  !form.sshUsername.trim() ||
                  !form.sshPassword
                }
              >
                {t("admin.persistWorkers.addSubmit")}
              </Button>
            </div>
          </form>
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
          <form
            autoComplete="off"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRedeploy();
            }}
          >
            <p className="text-sm text-muted-foreground">
              {t("admin.persistWorkers.redeployDescription", {
                name: redeployWorker?.name ?? "",
              })}
            </p>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-redeploy-password`}>
                {t("admin.persistWorkers.form.sshPassword")}
              </Label>
              <CredentialSecretInput
                id={`${idPrefix}-redeploy-password`}
                name={`${idPrefix}_redeploy_ssh_password`}
                value={redeployPassword}
                onChange={(event) => setRedeployPassword(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRedeployWorker(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isRedeploying || !redeployPassword}
              >
                {t("admin.persistWorkers.redeploySubmit")}
              </Button>
            </div>
          </form>
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
    </div>
  );
}
