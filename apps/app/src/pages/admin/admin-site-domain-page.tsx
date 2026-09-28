import type { SiteDomainErrorCode, SiteDomainStatus } from "@dafthunk/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { CredentialPlainInput } from "@/components/credential-secret-input";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  getSiteDomain,
  updateSiteDomain,
} from "@/services/site-domain-service";
import { ApiRequestError } from "@/services/utils";

import { probeSiteUrl, siteDomainJumpUrl } from "./site-domain-next-url";
import { siteDomainStatusLine } from "./site-domain-status-line";

const STATUS_LINE_KEYS = {
  unavailable: "admin.siteDomain.unavailable",
  unreachable: "admin.siteDomain.unreachable",
  savedNotApplied: "admin.siteDomain.savedNotApplied",
  savedHttpNotApplied: "admin.siteDomain.savedHttpNotApplied",
  currentDomain: "admin.siteDomain.currentDomain",
  currentHttp: "admin.siteDomain.currentHttp",
} as const;

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
  const [switching, setSwitching] = useState(false);
  const [originLost, setOriginLost] = useState(false);
  const announced = useRef(false);
  const jumped = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await getSiteDomain();
      setStatus(next);
      setDraft(next.siteAddress ?? "");
      setLoadError("");
      if (next.applying) {
        setSwitching(true);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("admin.siteDomain.loadFailed")
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

  const jumpUrl = useMemo(() => {
    if (!status || typeof window === "undefined") {
      return null;
    }
    return siteDomainJumpUrl(status.siteAddress, window.location, {
      switching,
      applyError: status.applyError,
    });
  }, [status, switching]);

  useEffect(() => {
    if (!switching) {
      return;
    }
    let stopped = false;
    const poll = async () => {
      try {
        const next = await getSiteDomain();
        if (stopped || announced.current) {
          return;
        }
        setOriginLost(false);
        setStatus(next);
        setDraft(next.siteAddress ?? "");
        if (next.applying) {
          return;
        }
        announced.current = true;
        setSwitching(false);
        if (next.applyError) {
          toast.error(t("admin.siteDomain.switchFailed"));
          return;
        }
        if (next.siteAddress) {
          toast.success(
            t("admin.siteDomain.switched", { domain: next.siteAddress })
          );
          return;
        }
        toast.success(t("admin.siteDomain.switchedHttp"));
      } catch {
        setOriginLost(true);
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [switching, t]);

  useEffect(() => {
    jumped.current = false;
    if (!jumpUrl || !originLost) {
      return;
    }
    let stopped = false;
    const probe = async () => {
      if (stopped || jumped.current) {
        return;
      }
      const ready = await probeSiteUrl(jumpUrl);
      if (stopped || !ready || jumped.current) {
        return;
      }
      jumped.current = true;
      window.location.replace(jumpUrl);
    };
    void probe();
    const timer = window.setInterval(() => {
      void probe();
    }, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jumpUrl, originLost]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status?.available || saving || switching) {
      return;
    }
    setSaving(true);
    try {
      const result = await updateSiteDomain(draft.trim());
      if (!result.restarting) {
        toast.success(t("admin.siteDomain.unchanged"));
        await load();
        return;
      }
      announced.current = false;
      jumped.current = false;
      setOriginLost(false);
      setStatus((current) =>
        current
          ? {
              ...current,
              siteAddress: result.siteAddress,
              httpOnly: result.siteAddress === null,
              applyError: null,
              applying: true,
            }
          : current
      );
      setSwitching(true);
    } catch (error) {
      const code =
        error instanceof ApiRequestError &&
        error.code &&
        isSiteDomainErrorCode(error.code)
          ? error.code
          : null;
      toast.error(
        code
          ? t(ERROR_KEYS[code] as "admin.siteDomain.errorInvalidDomain")
          : t("admin.siteDomain.saveFailed")
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
            {t(STATUS_LINE_KEYS[siteDomainStatusLine(status, switching)], {
              domain: status.siteAddress ?? "",
            })}
          </p>
          {switching ? (
            <p className="text-sm">{t("admin.siteDomain.applyingNow")}</p>
          ) : null}
          {jumpUrl ? (
            <Alert>
              <AlertTitle>{t("admin.siteDomain.jumpTitle")}</AlertTitle>
              <AlertDescription className="grid gap-3">
                <p>
                  {originLost
                    ? t("admin.siteDomain.originLost")
                    : t("admin.siteDomain.jumpHint")}
                </p>
                <a
                  className="break-all font-medium text-primary underline-offset-4 hover:underline"
                  href={jumpUrl}
                >
                  {jumpUrl}
                </a>
                <div>
                  <Button asChild>
                    <a href={jumpUrl}>{t("admin.siteDomain.openNewSite")}</a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          {status.applyError && !switching ? (
            <p className="whitespace-pre-wrap text-sm text-destructive">
              {status.applyError}
            </p>
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
                  disabled={saving || switching}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  {t("admin.siteDomain.fieldHelp")}
                </p>
              </div>
              <div>
                <Button type="submit" disabled={saving || switching}>
                  {switching
                    ? t("admin.siteDomain.switching")
                    : saving
                      ? t("common.saving")
                      : t("common.save")}
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
