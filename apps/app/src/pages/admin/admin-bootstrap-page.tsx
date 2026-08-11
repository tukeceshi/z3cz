import type { UpdateBootstrapSettingsRequest } from "@dafthunk/types";
import { AUTH_CONFIG_SECRET_MASK } from "@dafthunk/types";
import Rocket from "lucide-react/icons/rocket";
import { useEffect, useState } from "react";

import {
  CredentialPlainInput,
  CredentialSecretInput,
} from "@/components/credential-secret-input";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  syncAdminBootstrapShell,
  testAdminBootstrapR2Connection,
  updateAdminBootstrapConfig,
  useAdminBootstrapConfig,
} from "@/services/bootstrap-admin-service";

export function AdminBootstrapPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const {
    bootstrapConfig,
    bootstrapConfigError,
    isBootstrapConfigLoading,
    refreshBootstrapConfig,
  } = useAdminBootstrapConfig();

  const [shellEnabled, setShellEnabled] = useState(true);
  const [multiSourceRaceEnabled, setMultiSourceRaceEnabled] = useState(true);
  const [r2Enabled, setR2Enabled] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [originBaseUrl, setOriginBaseUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("bootstrapAdmin.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (!bootstrapConfig) {
      return;
    }
    setShellEnabled(bootstrapConfig.shellEnabled);
    setMultiSourceRaceEnabled(bootstrapConfig.multiSourceRaceEnabled);
    setR2Enabled(bootstrapConfig.r2Enabled);
    setAccountId(bootstrapConfig.accountId);
    setAccessKeyId(bootstrapConfig.accessKeyId);
    setSecretAccessKey(
      bootstrapConfig.secretAccessKeyConfigured
        ? AUTH_CONFIG_SECRET_MASK
        : ""
    );
    setBucketName(bootstrapConfig.bucketName);
    setPublicBaseUrl(bootstrapConfig.publicBaseUrl);
    setOriginBaseUrl(bootstrapConfig.originBaseUrl);
  }, [bootstrapConfig]);

  const buildPayload = (): UpdateBootstrapSettingsRequest => ({
    shellEnabled,
    multiSourceRaceEnabled,
    r2Enabled,
    accountId,
    accessKeyId,
    secretAccessKey:
      secretAccessKey === AUTH_CONFIG_SECRET_MASK ? undefined : secretAccessKey,
    bucketName,
    publicBaseUrl,
    originBaseUrl,
  });

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateAdminBootstrapConfig(buildPayload());
      await refreshBootstrapConfig();
      appToast.success(t("bootstrapAdmin.saveSuccess"));
    } catch {
      appToast.error(t("bootstrapAdmin.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestR2 = async () => {
    setIsTesting(true);
    try {
      await updateAdminBootstrapConfig(buildPayload());
      const result = await testAdminBootstrapR2Connection();
      await refreshBootstrapConfig();
      if (result.ok) {
        appToast.success(result.message);
      } else {
        appToast.error(result.message);
      }
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : t("bootstrapAdmin.testError")
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await updateAdminBootstrapConfig(buildPayload());
      const result = await syncAdminBootstrapShell();
      await refreshBootstrapConfig();
      appToast.success(result.message);
    } catch (error) {
      await refreshBootstrapConfig();
      appToast.error(
        error instanceof Error ? error.message : t("bootstrapAdmin.syncError")
      );
    } finally {
      setIsSyncing(false);
    }
  };

  if (isBootstrapConfigLoading) {
    return <InsetLoading title={t("bootstrapAdmin.title")} />;
  }

  if (bootstrapConfigError) {
    return (
      <InsetError
        title={t("bootstrapAdmin.title")}
        errorMessage={bootstrapConfigError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("bootstrapAdmin.title")}>
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="size-5" aria-hidden="true" />
              {t("bootstrapAdmin.title")}
            </CardTitle>
            <CardDescription>{t("bootstrapAdmin.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-6" onSubmit={handleSave} autoComplete="off">
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("bootstrapAdmin.shellEnabled")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("bootstrapAdmin.shellEnabledHint")}
                  </p>
                </div>
                <Switch checked={shellEnabled} onCheckedChange={setShellEnabled} />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("bootstrapAdmin.multiSourceRaceEnabled")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("bootstrapAdmin.multiSourceRaceEnabledHint")}
                  </p>
                </div>
                <Switch
                  checked={multiSourceRaceEnabled}
                  onCheckedChange={setMultiSourceRaceEnabled}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bootstrap_origin_base_url">
                  {t("bootstrapAdmin.originBaseUrl")}
                </Label>
                <CredentialPlainInput
                  id="bootstrap_origin_base_url"
                  name="bootstrap_origin_base_url"
                  value={originBaseUrl}
                  onChange={(event) => setOriginBaseUrl(event.target.value)}
                  placeholder="https://origin.example.com"
                />
                <p className="text-sm text-muted-foreground">
                  {t("bootstrapAdmin.originBaseUrlHint")}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("bootstrapAdmin.r2Enabled")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("bootstrapAdmin.r2EnabledHint")}
                  </p>
                </div>
                <Switch checked={r2Enabled} onCheckedChange={setR2Enabled} />
              </div>

              <div className="grid gap-4 rounded-lg border p-4">
                <p className="text-sm font-medium">{t("bootstrapAdmin.r2Credentials")}</p>
                <div className="grid gap-2">
                  <Label htmlFor="bootstrap_r2_account_id">
                    {t("bootstrapAdmin.accountId")}
                  </Label>
                  <CredentialPlainInput
                    id="bootstrap_r2_account_id"
                    name="bootstrap_r2_account_id"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bootstrap_r2_access_key_id">
                    {t("bootstrapAdmin.accessKeyId")}
                  </Label>
                  <CredentialPlainInput
                    id="bootstrap_r2_access_key_id"
                    name="bootstrap_r2_access_key_id"
                    value={accessKeyId}
                    onChange={(event) => setAccessKeyId(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bootstrap_r2_secret_access_key">
                    {t("bootstrapAdmin.secretAccessKey")}
                  </Label>
                  <CredentialSecretInput
                    id="bootstrap_r2_secret_access_key"
                    name="bootstrap_r2_secret_access_key"
                    value={secretAccessKey}
                    onChange={(event) => setSecretAccessKey(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bootstrap_r2_bucket_name">
                    {t("bootstrapAdmin.bucketName")}
                  </Label>
                  <CredentialPlainInput
                    id="bootstrap_r2_bucket_name"
                    name="bootstrap_r2_bucket_name"
                    value={bucketName}
                    onChange={(event) => setBucketName(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bootstrap_r2_public_base_url">
                    {t("bootstrapAdmin.publicBaseUrl")}
                  </Label>
                  <CredentialPlainInput
                    id="bootstrap_r2_public_base_url"
                    name="bootstrap_r2_public_base_url"
                    value={publicBaseUrl}
                    onChange={(event) => setPublicBaseUrl(event.target.value)}
                    placeholder="https://cdn.example.com/bootstrap"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t("common.saving") : t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isTesting || !r2Enabled}
                  onClick={() => void handleTestR2()}
                >
                  {isTesting
                    ? t("bootstrapAdmin.testing")
                    : t("bootstrapAdmin.testR2")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSyncing || !r2Enabled}
                  onClick={() => void handleSync()}
                >
                  {isSyncing
                    ? t("bootstrapAdmin.syncing")
                    : t("bootstrapAdmin.syncShell")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {bootstrapConfig ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("bootstrapAdmin.syncStatusTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>
                {t("bootstrapAdmin.lastSyncAt")}:{" "}
                {bootstrapConfig.lastSyncAt ?? t("bootstrapAdmin.never")}
              </p>
              <p>
                {t("bootstrapAdmin.lastSyncShellHash")}:{" "}
                {bootstrapConfig.lastSyncShellHash ?? "—"}
              </p>
              {bootstrapConfig.lastSyncError ? (
                <p className="text-destructive">
                  {t("bootstrapAdmin.lastSyncError")}:{" "}
                  {bootstrapConfig.lastSyncError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </InsetLayout>
  );
}
