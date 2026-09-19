import type { SystemUpdatePhase, SystemUpdateStatus } from "@dafthunk/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  checkSystemUpdate,
  getSystemUpdateStatus,
  rollbackSystemUpdate,
  startSystemUpdate,
} from "@/services/system-update-service";

const ACTIVE_PHASES = new Set<SystemUpdatePhase>([
  "checking",
  "preflight",
  "backing_up",
  "pulling",
  "draining",
  "migrating",
  "switching",
  "verifying",
  "rolling_back",
]);

function isReleaseVersion(value: string): boolean {
  return /^v?\d+\.\d+\.\d+/.test(value);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function phaseBadgeVariant(
  phase: SystemUpdatePhase
):
  | "translucent-success"
  | "translucent-error"
  | "translucent-warning"
  | "translucent-active"
  | "secondary" {
  if (phase === "succeeded" || phase === "ready" || phase === "no_update") {
    return "translucent-success";
  }
  if (phase === "failed" || phase === "manual_intervention") {
    return "translucent-error";
  }
  if (phase === "rolling_back" || phase === "rolled_back") {
    return "translucent-warning";
  }
  if (ACTIVE_PHASES.has(phase)) {
    return "translucent-active";
  }
  return "secondary";
}

export function AdminSystemUpdatePage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const [status, setStatus] = useState<SystemUpdateStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState("");
  const mountedRef = useRef(true);

  const phaseLabel = useCallback(
    (phase: SystemUpdatePhase) => t(`admin.systemUpdate.phases.${phase}`),
    [t]
  );

  const load = useCallback(
    async (initial = false) => {
      if (initial) {
        setLoading(true);
      }
      try {
        const next = await getSystemUpdateStatus();
        if (!mountedRef.current) {
          return;
        }
        setStatus(next);
        setLoadError("");
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : t("admin.systemUpdate.loadFailed")
        );
      } finally {
        if (mountedRef.current && initial) {
          setLoading(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("sidebar.systemUpdate") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    mountedRef.current = true;
    void load(true);
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const operationActive = Boolean(
    status && ACTIVE_PHASES.has(status.operation.phase)
  );

  useEffect(() => {
    if (!operationActive) {
      return;
    }
    const timer = window.setInterval(() => void load(false), 2500);
    return () => window.clearInterval(timer);
  }, [load, operationActive]);

  const blockingFailed =
    status?.checks.some(
      (check) => check.blocking && check.status === "failed"
    ) ?? false;

  const handleCheck = async () => {
    setChecking(true);
    try {
      const next = await checkSystemUpdate();
      setStatus(next);
      toast.success(
        next.updateAvailable && next.latestRelease
          ? t("admin.systemUpdate.checkFound", {
              version: next.latestRelease.version,
            })
          : t("admin.systemUpdate.checkLatest")
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.systemUpdate.checkFailed")
      );
      await load(false);
    } finally {
      setChecking(false);
    }
  };

  const handleStart = async () => {
    if (!status?.latestRelease) {
      return;
    }
    setStarting(true);
    try {
      const next = await startSystemUpdate(status.latestRelease.version);
      setStatus(next);
      setConfirmOpen(false);
      toast.success(t("admin.systemUpdate.startSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.systemUpdate.startFailed")
      );
    } finally {
      setStarting(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackReason.trim()) {
      toast.error(t("admin.systemUpdate.rollbackReasonRequired"));
      return;
    }
    try {
      const next = await rollbackSystemUpdate(rollbackReason.trim());
      setStatus(next);
      setRollbackOpen(false);
      setRollbackReason("");
      toast.success(t("admin.systemUpdate.rollbackStarted"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.systemUpdate.rollbackFailed")
      );
    }
  };

  if (loading) {
    return <InsetLoading title={t("admin.systemUpdate.title")} />;
  }

  if (loadError && !status) {
    return (
      <InsetError
        title={t("admin.systemUpdate.title")}
        errorMessage={loadError}
      />
    );
  }

  const phase = status?.operation.phase ?? "idle";

  return (
    <InsetLayout title={t("admin.systemUpdate.title")}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
        <p className="text-sm text-muted-foreground">
          {t("admin.systemUpdate.description")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleCheck()}
            disabled={checking || operationActive}
          >
            {checking
              ? t("admin.systemUpdate.checking")
              : t("admin.systemUpdate.check")}
          </Button>
        </div>

        {!status?.supported ? (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
            <p className="font-medium">
              {t("admin.systemUpdate.unsupportedTitle")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("admin.systemUpdate.unsupportedDetail")}
            </p>
          </div>
        ) : null}

        {status?.operation.phase === "manual_intervention" ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
            <p className="font-medium">{t("admin.systemUpdate.manualTitle")}</p>
            <p className="mt-1 text-muted-foreground">
              {status.operation.rollbackError ||
                status.operation.error ||
                t("admin.systemUpdate.manualDetail")}
            </p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{t("admin.systemUpdate.releaseTitle")}</CardTitle>
                <Badge variant={phaseBadgeVariant(phase)}>
                  {phaseLabel(phase)}
                </Badge>
              </div>
              <CardDescription>
                {status?.updateAvailable && status.latestRelease
                  ? t("admin.systemUpdate.releaseAvailable", {
                      current: status.currentVersion,
                      latest: status.latestRelease.version,
                    })
                  : t("admin.systemUpdate.releaseHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">
                    {t("admin.systemUpdate.current")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {status?.currentVersion || "—"}
                  </p>
                  {status?.currentVersion &&
                  !isReleaseVersion(status.currentVersion) ? (
                    <Badge variant="translucent-warning" className="mt-2">
                      {t("admin.systemUpdate.informal")}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("admin.systemUpdate.latest")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {status?.latestRelease?.version ||
                      t("admin.systemUpdate.notChecked")}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-muted-foreground">
                <dt>{t("admin.systemUpdate.deployment")}</dt>
                <dd className="text-foreground">{status?.deployment || "—"}</dd>
                <dt>{t("admin.systemUpdate.publishedAt")}</dt>
                <dd className="text-foreground">
                  {formatDate(status?.latestRelease?.publishedAt)}
                </dd>
              </dl>
              {status?.latestRelease?.body ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                  {status.latestRelease.body}
                </pre>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={
                  !status?.connected ||
                  !status.updateAvailable ||
                  operationActive ||
                  blockingFailed ||
                  starting
                }
              >
                {t("admin.systemUpdate.start")}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.systemUpdate.checksTitle")}</CardTitle>
              <CardDescription>
                {status?.connected
                  ? t("admin.systemUpdate.updaterConnected")
                  : t("admin.systemUpdate.updaterDisconnected")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(status?.checks || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("admin.systemUpdate.checksEmpty")}
                </p>
              ) : (
                status?.checks.map((check) => (
                  <div
                    key={check.key}
                    className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{check.label}</p>
                      {check.detail ? (
                        <p className="text-muted-foreground">{check.detail}</p>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        check.status === "passed"
                          ? "translucent-success"
                          : check.status === "failed"
                            ? "translucent-error"
                            : "secondary"
                      }
                    >
                      {t(`admin.systemUpdate.checkStatus.${check.status}`)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.systemUpdate.progressTitle")}</CardTitle>
            <CardDescription>
              {t("admin.systemUpdate.progressHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.operation.error ? (
              <p className="mb-3 text-sm text-destructive">
                {status.operation.error}
              </p>
            ) : null}
            {(status?.operation.logs || []).length ? (
              <ol className="space-y-3">
                {status?.operation.logs.map((entry, index) => (
                  <li
                    key={`${entry.at}-${index}`}
                    className="grid grid-cols-[1fr_auto] gap-3 border-l-2 border-muted pl-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{phaseLabel(entry.phase)}</p>
                      <p className="text-muted-foreground">{entry.message}</p>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {formatDate(entry.at)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("admin.systemUpdate.progressEmpty")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.systemUpdate.backupTitle")}</CardTitle>
            <CardDescription>
              {t("admin.systemUpdate.backupHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.lastBackup ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">
                  {t("admin.systemUpdate.backupId")}
                </dt>
                <dd>{status.lastBackup.id}</dd>
                <dt className="text-muted-foreground">
                  {t("admin.systemUpdate.backupVersion")}
                </dt>
                <dd>{status.lastBackup.version}</dd>
                <dt className="text-muted-foreground">
                  {t("admin.systemUpdate.backupAt")}
                </dt>
                <dd>{formatDate(status.lastBackup.createdAt)}</dd>
                <dt className="text-muted-foreground">
                  {t("admin.systemUpdate.backupSize")}
                </dt>
                <dd>{formatBytes(status.lastBackup.size)}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("admin.systemUpdate.backupEmpty")}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              variant="destructive"
              onClick={() => setRollbackOpen(true)}
              disabled={
                !status?.rollbackVersion || operationActive || !status.connected
              }
            >
              {t("admin.systemUpdate.rollback")}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.systemUpdate.confirmTitle", {
                version: status?.latestRelease?.version ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.systemUpdate.confirmDetail")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>
              {t("admin.systemUpdate.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleStart();
              }}
              disabled={starting}
            >
              {t("admin.systemUpdate.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.systemUpdate.rollbackTitle", {
                version: status?.rollbackVersion ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.systemUpdate.rollbackDetail")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rollbackReason}
            onChange={(event) => setRollbackReason(event.target.value)}
            maxLength={300}
            rows={3}
            placeholder={t("admin.systemUpdate.rollbackReasonPlaceholder")}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("admin.systemUpdate.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRollback();
              }}
            >
              {t("admin.systemUpdate.rollbackConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
