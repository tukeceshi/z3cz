import type { SiteDomainErrorCode, SiteDomainStatus } from "@dafthunk/types";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { CredentialPlainInput } from "@/components/credential-secret-input";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ApiRequestError } from "@/services/utils";
import {
  getSiteDomain,
  updateSiteDomain,
} from "@/services/site-domain-service";

const ERROR_KEYS: Record<SiteDomainErrorCode, string> = {
  invalid_chars: "admin.siteDomain.errorInvalidChars",
  local_name: "admin.siteDomain.errorLocalName",
  invalid_domain: "admin.siteDomain.errorInvalidDomain",
  applying: "admin.siteDomain.errorApplying",
  unavailable: "admin.siteDomain.errorUnavailable",
};

function isSiteDomainErrorCode(value: string): value is SiteDomainErrorCode {
  return value in ERROR_KEYS;
}

export function AdminSiteDomainPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const [status, setStatus] = useState<SiteDomainStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getSiteDomain();
      setStatus(next);
      setDraft(next.siteAddress ?? "");
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t("admin.siteDomain.loadFailed")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("admin.siteDomain.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status?.available || saving) {
      return;
    }
    setSaving(true);
    try {
      const result = await updateSiteDomain(draft.trim());
      toast.success(
        result.restarting
          ? t("admin.siteDomain.restarting")
          : t("admin.siteDomain.unchanged")
      );
      if (!result.restarting) {
        await load();
      }
    } catch (error) {
      const code =
        error instanceof ApiRequestError && error.code && isSiteDomainErrorCode(error.code)
          ? error.code
          : null;
      toast.error(
        code ? t(ERROR_KEYS[code] as "admin.siteDomain.errorInvalidDomain") : t("admin.siteDomain.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <InsetLoading title={t("admin.siteDomain.title")} />;
  }

  if (loadError || !status) {
    return (
      <InsetError
        title={t("admin.siteDomain.title")}
        errorMessage={loadError || t("admin.siteDomain.loadFailed")}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.siteDomain.title")}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("admin.siteDomain.title")}</CardTitle>
          <CardDescription>{t("admin.siteDomain.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm">
            {status.available
              ? status.siteAddress
                ? t("admin.siteDomain.currentDomain", {
                    domain: status.siteAddress,
                  })
                : t("admin.siteDomain.currentHttp")
              : status.unavailableReason === "unreachable"
                ? t("admin.siteDomain.unreachable")
                : t("admin.siteDomain.unavailable")}
          </p>
          {status.applyError ? (
            <p className="text-sm text-destructive">{status.applyError}</p>
          ) : null}
          {status.available ? (
            <form
              className="grid gap-4"
              autoComplete="off"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-2">
                <Label htmlFor="site-domain-address">
                  {t("admin.siteDomain.fieldLabel")}
                </Label>
                <CredentialPlainInput
                  id="site-domain-address"
                  name="site_domain"
                  value={draft}
                  placeholder={t("admin.siteDomain.placeholder")}
                  disabled={saving}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  {t("admin.siteDomain.fieldHelp")}
                </p>
              </div>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
        <CardFooter />
      </Card>
    </InsetLayout>
  );
}
