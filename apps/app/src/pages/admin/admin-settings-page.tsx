import type { UpdateSiteSettingsRequest } from "@dafthunk/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mutate as mutateGlobal } from "swr";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  updateAdminSiteSettings,
  useAdminSiteSettings,
} from "@/services/site-settings-service";

export function AdminSettingsPage() {
  const { t, refreshSiteSettings, siteSettings } = useTranslation();
  const { settings, settingsError, isSettingsLoading, refreshSettings } =
    useAdminSiteSettings();
  const setBreadcrumbs = useBreadcrumbsSetter();

  const [siteName, setSiteName] = useState("");
  const [siteTagline, setSiteTagline] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [newUserTourEnabled, setNewUserTourEnabled] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("siteSettings.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setSiteName(settings.siteName);
    setSiteTagline(settings.siteTagline);
    setSupportEmail(settings.supportEmail ?? "");
    setNewUserTourEnabled(settings.newUserTourEnabled);
    setMaintenanceEnabled(settings.maintenanceEnabled);
    setMaintenanceMessage(settings.maintenanceMessage ?? "");
  }, [settings]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    const payload: UpdateSiteSettingsRequest = {
      siteName: siteName.trim(),
      siteTagline: siteTagline.trim(),
      supportEmail: supportEmail.trim() ? supportEmail.trim() : null,
      newUserTourEnabled,
      maintenanceEnabled,
      maintenanceMessage: maintenanceMessage.trim()
        ? maintenanceMessage.trim()
        : null,
    };

    try {
      await updateAdminSiteSettings(payload);
      await Promise.all([
        refreshSettings(),
        refreshSiteSettings(),
        mutateGlobal("/site-settings"),
      ]);
      toast.success(t("siteSettings.saveSuccess"));
    } catch {
      toast.error(t("siteSettings.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isSettingsLoading) {
    return <InsetLoading title={t("siteSettings.title")} />;
  }

  if (settingsError) {
    return (
      <InsetError
        title={t("siteSettings.title")}
        errorMessage={settingsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("siteSettings.title")}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("siteSettings.title")}</CardTitle>
          <CardDescription>{t("siteSettings.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("siteSettings.preview")}
            </p>
            <p className="mt-1 text-lg font-semibold">{siteName || siteSettings.siteName}</p>
            <p className="text-sm text-muted-foreground">
              {siteTagline || siteSettings.siteTagline}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("siteSettings.previewHint")}
            </p>
          </div>
          <form className="grid gap-6" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="siteName">{t("siteSettings.siteName")}</Label>
              <Input
                id="siteName"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                {t("siteSettings.siteNameHelp")}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="siteTagline">{t("siteSettings.siteTagline")}</Label>
              <Input
                id="siteTagline"
                value={siteTagline}
                onChange={(event) => setSiteTagline(event.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                {t("siteSettings.siteTaglineHelp")}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supportEmail">
                {t("siteSettings.supportEmail")}
              </Label>
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
                placeholder={t("siteSettings.supportEmailPlaceholder")}
              />
              <p className="text-sm text-muted-foreground">
                {t("siteSettings.supportEmailHelp")}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {t("siteSettings.newUserTourToggle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("siteSettings.newUserTourHint")}
                </p>
              </div>
              <Switch
                checked={newUserTourEnabled}
                onCheckedChange={setNewUserTourEnabled}
              />
            </div>

            <div className="rounded-lg border px-4 py-3 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {t("siteSettings.maintenanceToggle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("siteSettings.maintenanceHint")}
                  </p>
                </div>
                <Switch
                  checked={maintenanceEnabled}
                  onCheckedChange={setMaintenanceEnabled}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maintenanceMessage">
                  {t("siteSettings.maintenanceMessage")}
                </Label>
                <Textarea
                  id="maintenanceMessage"
                  value={maintenanceMessage}
                  onChange={(event) => setMaintenanceMessage(event.target.value)}
                  placeholder={t("siteSettings.maintenanceMessagePlaceholder")}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {t("siteSettings.maintenanceMessageHelp")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </InsetLayout>
  );
}
