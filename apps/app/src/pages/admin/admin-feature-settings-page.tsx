import type {
  PlatformFeatureConfig,
  ResourceFeatureId,
  WorkflowScheme,
} from "@dafthunk/types";
import {
  DEFAULT_PLATFORM_FEATURE_CONFIG,
  mergePlatformFeatureConfig,
} from "@dafthunk/types";
import Copy from "lucide-react/icons/copy";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { mutate as mutateGlobal } from "swr";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  buildDockerCommand,
  FEATURE_CATALOG,
  RESOURCE_FEATURE_IDS,
} from "@/lib/platform-feature-catalog";
import {
  FEATURE_CONFIG_KEY,
  updateAdminFeatureConfig,
  useAdminFeatureConfig,
} from "@/services/site-settings-service";
import { useAdminWorkflowSchemes } from "@/services/workflow-scheme-service";

export function AdminFeatureSettingsPage() {
  const { t, refreshSiteSettings } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const {
    featureConfig,
    featureConfigError,
    isFeatureConfigLoading,
    refreshFeatureConfig,
  } = useAdminFeatureConfig();
  const { schemes, isSchemesLoading } = useAdminWorkflowSchemes();

  const [form, setForm] = useState<PlatformFeatureConfig>(
    DEFAULT_PLATFORM_FEATURE_CONFIG
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("featureSettings.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (featureConfig) {
      setForm(mergePlatformFeatureConfig(featureConfig));
    }
  }, [featureConfig]);

  const enabledSchemes = useMemo(
    () => (schemes ?? []).filter((scheme) => scheme.enabled),
    [schemes]
  );

  const setNavEnabled = (id: ResourceFeatureId, enabled: boolean) => {
    setForm((current) => ({
      ...current,
      nav: {
        ...current.nav,
        [id]: { enabled },
      },
    }));
  };

  const handleCopyDocker = async (featureId: ResourceFeatureId) => {
    const command = buildDockerCommand(featureId);
    if (!command) {
      return;
    }
    await navigator.clipboard.writeText(command);
    toast.success(t("featureSettings.dockerCopied"));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await updateAdminFeatureConfig({ featureConfig: form });
      await Promise.all([
        refreshFeatureConfig(),
        refreshSiteSettings(),
        mutateGlobal("/site-settings"),
        mutateGlobal(FEATURE_CONFIG_KEY),
      ]);
      toast.success(t("featureSettings.saveSuccess"));
    } catch {
      toast.error(t("featureSettings.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isFeatureConfigLoading || isSchemesLoading) {
    return <InsetLoading title={t("featureSettings.title")} />;
  }

  if (featureConfigError) {
    return (
      <InsetError
        title={t("featureSettings.title")}
        errorMessage={featureConfigError.message}
      />
    );
  }

  const renderFeatureRow = (featureId: ResourceFeatureId) => {
    const entry = FEATURE_CATALOG[featureId];
    const enabled = form.nav[featureId]?.enabled ?? false;
    const dockerCommand = buildDockerCommand(featureId);
    const showDocker =
      dockerCommand &&
      (entry.category === "admin_and_docker"
        ? enabled
        : entry.category === "docker_only");

    return (
      <div
        key={featureId}
        className="rounded-lg border px-4 py-3 space-y-3"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{t(entry.labelKey)}</p>
              <Badge variant="outline" className="text-xs">
                {entry.category === "admin"
                  ? t("featureSettings.category.admin")
                  : entry.category === "admin_and_docker"
                    ? t("featureSettings.category.adminAndDocker")
                    : t("featureSettings.category.dockerOnly")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(entry.descriptionKey)}
            </p>
          </div>
          {entry.category !== "docker_only" ? (
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => setNavEnabled(featureId, checked)}
            />
          ) : null}
        </div>

        {showDocker ? (
          <div className="rounded-md bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("featureSettings.dockerTitle")}
            </p>
            <pre className="overflow-x-auto text-xs whitespace-pre-wrap">
              {dockerCommand}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopyDocker(featureId)}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              {t("featureSettings.copyDocker")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <InsetLayout title={t("featureSettings.title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Alert>
          <AlertDescription>{t("featureSettings.resourcesHint")}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>{t("featureSettings.navTitle")}</CardTitle>
            <CardDescription>{t("featureSettings.navDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RESOURCE_FEATURE_IDS.map((featureId) => renderFeatureRow(featureId))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("featureSettings.schemeTitle")}</CardTitle>
            <CardDescription>{t("featureSettings.schemeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Label htmlFor="defaultScheme">
              {t("featureSettings.defaultScheme")}
            </Label>
            <Select
              value={form.defaultWorkflowSchemeId}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  defaultWorkflowSchemeId: value,
                }))
              }
            >
              <SelectTrigger id="defaultScheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {enabledSchemes.map((scheme: WorkflowScheme) => (
                  <SelectItem key={scheme.id} value={scheme.id}>
                    {scheme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("featureSettings.allNavTitle")}</CardTitle>
            <CardDescription>{t("featureSettings.allNavDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {RESOURCE_FEATURE_IDS.map((id) => (
              <div key={id} className="flex justify-between gap-4">
                <span>{t(FEATURE_CATALOG[id].labelKey)}</span>
                <span>
                  {form.nav[id]?.enabled
                    ? t("featureSettings.enabled")
                    : t("featureSettings.disabled")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </InsetLayout>
  );
}
