import type {
  AdminBootstrapSettings,
  BootstrapStorageProvider,
  UpdateBootstrapSettingsRequest,
} from "@dafthunk/types";
import {
  AUTH_CONFIG_SECRET_MASK,
  defaultVolcanoTosRegionForLocale,
  VOLCANO_TOS_REGIONS,
} from "@dafthunk/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  syncAdminBootstrapShell,
  testAdminBootstrapR2Connection,
  updateAdminBootstrapConfig,
  useAdminBootstrapConfig,
} from "@/services/bootstrap-admin-service";

function readStorageProvider(
  value: BootstrapStorageProvider | undefined
): BootstrapStorageProvider {
  return value === "tos" ? "tos" : "r2";
}

interface BootstrapSettingsFormProps {
  readonly config: AdminBootstrapSettings;
  readonly onRefresh: () => Promise<void>;
}

function BootstrapSettingsForm({
  config,
  onRefresh,
}: BootstrapSettingsFormProps) {
  const { t, locale } = useTranslation();
  const appToast = useAppToast();

  const [r2Enabled, setR2Enabled] = useState(config.r2Enabled);
  const [r2Only, setR2Only] = useState(config.r2Only);
  const [storageProvider, setStorageProvider] = useState(
    readStorageProvider(config.storageProvider)
  );
  const [accountId, setAccountId] = useState(config.accountId);
  const [accessKeyId, setAccessKeyId] = useState(config.accessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState(
    config.secretAccessKeyConfigured ? AUTH_CONFIG_SECRET_MASK : ""
  );
  const [bucketName, setBucketName] = useState(config.bucketName);
  const [publicBaseUrl, setPublicBaseUrl] = useState(config.publicBaseUrl);
  const [tosRegion, setTosRegion] = useState(config.tosRegion);
  const [tosAccessKeyId, setTosAccessKeyId] = useState(config.tosAccessKeyId);
  const [tosSecretAccessKey, setTosSecretAccessKey] = useState(
    config.tosSecretAccessKeyConfigured ? AUTH_CONFIG_SECRET_MASK : ""
  );
  const [tosBucketName, setTosBucketName] = useState(config.tosBucketName);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const storageOnlyAllowed = config.storageOnlyAllowed;
  const storageOnlyEnabled = r2Enabled && storageOnlyAllowed;
  const selectedTosRegion = VOLCANO_TOS_REGIONS.find(
    (entry) => entry.code === tosRegion
  );
  const knownTosRegion = Boolean(selectedTosRegion);

  const handleStorageProviderChange = (value: string) => {
    const next = readStorageProvider(
      value === "tos" ? "tos" : "r2"
    );
    setStorageProvider(next);
    setR2Only(false);
    if (next === "tos" && tosRegion.trim().length === 0) {
      setTosRegion(defaultVolcanoTosRegionForLocale(locale));
    }
  };

  const buildPayload = (): UpdateBootstrapSettingsRequest => ({
    r2Enabled,
    r2Only: storageOnlyEnabled ? r2Only : false,
    storageProvider,
    accountId,
    accessKeyId,
    secretAccessKey:
      secretAccessKey === AUTH_CONFIG_SECRET_MASK ? undefined : secretAccessKey,
    bucketName,
    publicBaseUrl,
    tosRegion,
    tosAccessKeyId,
    tosSecretAccessKey:
      tosSecretAccessKey === AUTH_CONFIG_SECRET_MASK
        ? undefined
        : tosSecretAccessKey,
    tosBucketName,
  });

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateAdminBootstrapConfig(buildPayload());
      await onRefresh();
      appToast.success(t("bootstrapAdmin.saveSuccess"));
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : t("bootstrapAdmin.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await updateAdminBootstrapConfig(buildPayload());
      const result = await testAdminBootstrapR2Connection();
      await onRefresh();
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
      await onRefresh();
      appToast.success(result.message);
    } catch (error) {
      await onRefresh();
      appToast.error(
        error instanceof Error ? error.message : t("bootstrapAdmin.syncError")
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <form className="grid gap-6" onSubmit={handleSave} autoComplete="off">
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">{t("bootstrapAdmin.r2Enabled")}</p>
          <p className="text-xs text-muted-foreground">
            {t("bootstrapAdmin.r2EnabledHint")}
          </p>
        </div>
        <Switch
          checked={r2Enabled}
          onCheckedChange={(checked) => {
            setR2Enabled(checked);
            if (!checked) {
              setR2Only(false);
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">{t("bootstrapAdmin.r2Only")}</p>
          <p className="text-xs text-muted-foreground">
            {r2Enabled && !storageOnlyAllowed
              ? t("bootstrapAdmin.r2OnlyNeedsSync")
              : t("bootstrapAdmin.r2OnlyHint")}
          </p>
        </div>
        <Switch
          checked={storageOnlyEnabled && r2Only}
          disabled={!storageOnlyEnabled}
          onCheckedChange={setR2Only}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="bootstrap_storage_provider">
          {t("bootstrapAdmin.storageProvider")}
        </Label>
        <Select value={storageProvider} onValueChange={handleStorageProviderChange}>
          <SelectTrigger id="bootstrap_storage_provider">
            <SelectValue>
              {storageProvider === "tos"
                ? t("bootstrapAdmin.storageProviderTos")
                : t("bootstrapAdmin.storageProviderR2")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="r2">
              {t("bootstrapAdmin.storageProviderR2")}
            </SelectItem>
            <SelectItem value="tos">
              {t("bootstrapAdmin.storageProviderTos")}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t("bootstrapAdmin.storageProviderHint")}
        </p>
      </div>

      {storageProvider === "tos" ? (
        <div className="grid gap-4 rounded-lg border p-4">
          <p className="text-sm font-medium">
            {t("bootstrapAdmin.tosCredentials")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("bootstrapAdmin.tosSignedUrlHint")}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="bootstrap_tos_region">
              {t("bootstrapAdmin.tosRegion")}
            </Label>
            <Select value={tosRegion || undefined} onValueChange={setTosRegion}>
              <SelectTrigger id="bootstrap_tos_region">
                <SelectValue placeholder={t("bootstrapAdmin.tosRegion")}>
                  {selectedTosRegion
                    ? t(selectedTosRegion.labelKey)
                    : tosRegion || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VOLCANO_TOS_REGIONS.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {t(entry.labelKey)}
                  </SelectItem>
                ))}
                {tosRegion && !knownTosRegion ? (
                  <SelectItem value={tosRegion}>{tosRegion}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bootstrap_tos_access_key_id">
              {t("bootstrapAdmin.tosAccessKeyId")}
            </Label>
            <CredentialPlainInput
              id="bootstrap_tos_access_key_id"
              name="bootstrap_tos_access_key_id"
              value={tosAccessKeyId}
              onChange={(event) => setTosAccessKeyId(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bootstrap_tos_secret_access_key">
              {t("bootstrapAdmin.tosSecretAccessKey")}
            </Label>
            <CredentialSecretInput
              id="bootstrap_tos_secret_access_key"
              name="bootstrap_tos_secret_access_key"
              value={tosSecretAccessKey}
              onChange={(event) => setTosSecretAccessKey(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bootstrap_tos_bucket_name">
              {t("bootstrapAdmin.tosBucketName")}
            </Label>
            <CredentialPlainInput
              id="bootstrap_tos_bucket_name"
              name="bootstrap_tos_bucket_name"
              value={tosBucketName}
              onChange={(event) => setTosBucketName(event.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 rounded-lg border p-4">
          <p className="text-sm font-medium">
            {t("bootstrapAdmin.r2Credentials")}
          </p>
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
              placeholder="https://cdn.example.com"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? t("common.saving") : t("common.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isTesting || !r2Enabled}
          onClick={() => void handleTestConnection()}
        >
          {isTesting
            ? t("bootstrapAdmin.testing")
            : storageProvider === "tos"
              ? t("bootstrapAdmin.testTos")
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
  );
}

export function AdminBootstrapPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const {
    bootstrapConfig,
    bootstrapConfigError,
    isBootstrapConfigLoading,
    refreshBootstrapConfig,
  } = useAdminBootstrapConfig();

  useEffect(() => {
    setBreadcrumbs([{ label: t("bootstrapAdmin.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleRefresh = async () => {
    await refreshBootstrapConfig();
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

  if (!bootstrapConfig) {
    return <InsetLoading title={t("bootstrapAdmin.title")} />;
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
            <BootstrapSettingsForm
              key={`${bootstrapConfig.updatedAt}:${bootstrapConfig.storageProvider}`}
              config={bootstrapConfig}
              onRefresh={handleRefresh}
            />
          </CardContent>
        </Card>

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
      </div>
    </InsetLayout>
  );
}
