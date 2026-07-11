import CreditCard from "lucide-react/icons/credit-card";
import ExternalLink from "lucide-react/icons/external-link";
import Pencil from "lucide-react/icons/pencil";
import Sparkles from "lucide-react/icons/sparkles";
import X from "lucide-react/icons/x";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  createBillingPortal,
  createCheckoutSession,
  updateOverageLimit,
  useBilling,
} from "@/services/billing-service";
import { formatDate } from "@/utils/date";

export function BillingPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { billing, billingError, isBillingLoading, mutateBilling } =
    useBilling();
  const { organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [isSavingLimit, setIsSavingLimit] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.billing") }]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      mutateBilling();
      setSearchParams({}, { replace: true });
      appToast.success("pages.billing.checkoutSuccess");
    }
  }, [searchParams, setSearchParams, mutateBilling, appToast]);

  const handleUpgrade = useCallback(async () => {
    if (!organization?.id) return;

    setIsUpgrading(true);
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const successUrl = `${baseUrl}?checkout=success`;
      const cancelUrl = baseUrl;
      const checkoutUrl = await createCheckoutSession(
        organization.id,
        successUrl,
        cancelUrl
      );
      window.location.href = checkoutUrl;
    } catch (error) {
      appToast.error("pages.billing.checkoutFailed");
      console.error("Checkout error:", error);
      setIsUpgrading(false);
    }
  }, [organization?.id, appToast]);

  const handleManageSubscription = useCallback(async () => {
    if (!organization?.id) return;

    setIsOpeningPortal(true);
    try {
      const returnUrl = window.location.href;
      const portalUrl = await createBillingPortal(organization.id, returnUrl);
      window.location.href = portalUrl;
    } catch (error) {
      appToast.error("pages.billing.portalFailed");
      console.error("Portal error:", error);
      setIsOpeningPortal(false);
    }
  }, [organization?.id, appToast]);

  const handleStartEditLimit = useCallback(() => {
    setLimitInput(billing?.overageLimit?.toString() ?? "");
    setIsEditingLimit(true);
  }, [billing?.overageLimit]);

  const handleCancelEditLimit = useCallback(() => {
    setIsEditingLimit(false);
    setLimitInput("");
  }, []);

  const handleSaveLimit = useCallback(async () => {
    if (!organization?.id) return;

    setIsSavingLimit(true);
    try {
      const newLimit = limitInput.trim() === "" ? null : parseInt(limitInput);
      if (newLimit !== null && (isNaN(newLimit) || newLimit < 0)) {
        appToast.error("pages.billing.invalidNumber");
        setIsSavingLimit(false);
        return;
      }
      await updateOverageLimit(organization.id, newLimit);
      await mutateBilling();
      setIsEditingLimit(false);
      if (newLimit === null) {
        appToast.success("pages.billing.limitRemoved");
      } else {
        appToast.success("pages.billing.limitSetToast", {
          count: newLimit.toLocaleString(),
        });
      }
    } catch (error) {
      appToast.error("pages.billing.limitUpdateFailed");
      console.error("Update limit error:", error);
    } finally {
      setIsSavingLimit(false);
    }
  }, [organization?.id, limitInput, mutateBilling, appToast]);

  const handleRemoveLimit = useCallback(async () => {
    if (!organization?.id) return;

    setIsSavingLimit(true);
    try {
      await updateOverageLimit(organization.id, null);
      await mutateBilling();
      setIsEditingLimit(false);
      appToast.success("pages.billing.limitRemoved");
    } catch (error) {
      appToast.error("pages.billing.limitRemoveFailed");
      console.error("Remove limit error:", error);
    } finally {
      setIsSavingLimit(false);
    }
  }, [organization?.id, mutateBilling, appToast]);

  if (isBillingLoading && !billing) {
    return <InsetLoading title={t("pages.billing.title")} />;
  }

  if (billingError) {
    return (
      <InsetError
        title={t("pages.billing.title")}
        errorMessage={billingError.message}
      />
    );
  }

  const isPro = billing?.plan === "pro";
  const isCanceled = billing?.subscriptionStatus === "canceled";
  const isActive = billing?.subscriptionStatus === "active";
  const usagePercent = billing?.includedCredits
    ? Math.min(100, (billing.usageThisPeriod / billing.includedCredits) * 100)
    : 0;
  const hasOverageLimit = billing?.overageLimit != null;
  const currentOverage = Math.max(
    0,
    (billing?.usageThisPeriod ?? 0) - (billing?.includedCredits ?? 0)
  );
  const isOverageAtLimit =
    hasOverageLimit && currentOverage >= billing!.overageLimit!;

  const getPlanDescription = () => {
    if (isPro && isCanceled) {
      return t("pages.billing.canceledDescription");
    }
    if (isPro && isActive) {
      return t("pages.billing.proDescription");
    }
    return t("pages.billing.trialDescription");
  };

  const getStatusLine = () => {
    if (!billing?.currentPeriodEnd) return null;
    const endDate = formatDate(new Date(billing.currentPeriodEnd));

    if (isCanceled) {
      return t("pages.billing.accessEnds", { date: endDate });
    }
    if (isActive) {
      return t("pages.billing.renews", { date: endDate });
    }
    return null;
  };

  return (
    <InsetLayout title={t("pages.billing.title")}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {t("pages.billing.currentPlan")}
                  <Badge variant={isPro ? "default" : "secondary"}>
                    {isPro
                      ? t("pages.dashboard.usage.earlyAdopter")
                      : t("pages.dashboard.usage.trial")}
                  </Badge>
                  {isCanceled && (
                    <Badge variant="destructive">
                      {t("pages.executions.status.cancelled")}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{getPlanDescription()}</CardDescription>
                {getStatusLine() && (
                  <p className="text-sm text-muted-foreground">
                    {getStatusLine()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {isPro && isActive && (
                  <Button
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={isOpeningPortal}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isOpeningPortal
                      ? t("common.loading")
                      : t("pages.billing.manageSubscription")}
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                )}
                {isPro && isCanceled && (
                  <Button onClick={handleUpgrade} disabled={isUpgrading}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isUpgrading
                      ? t("common.loading")
                      : t("pages.billing.resubscribe")}
                  </Button>
                )}
                {!isPro && (
                  <Button onClick={handleUpgrade} disabled={isUpgrading}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isUpgrading
                      ? t("common.loading")
                      : t("pages.billing.upgrade")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {isPro && (
          <Card>
            <CardHeader>
              <CardTitle>{t("pages.dashboard.usage.title")}</CardTitle>
              <CardDescription>
                {billing?.currentPeriodStart && billing?.currentPeriodEnd && (
                  <>
                    {formatDate(new Date(billing.currentPeriodStart))} –{" "}
                    {formatDate(new Date(billing.currentPeriodEnd))}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {t("pages.dashboard.usage.includedUsage")}
                  </span>
                  <span>
                    {Math.min(
                      billing?.usageThisPeriod ?? 0,
                      billing?.includedCredits ?? 0
                    ).toLocaleString()}{" "}
                    / {billing?.includedCredits?.toLocaleString() ?? 0}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {usagePercent < 100
                    ? t("pages.dashboard.usage.remaining", {
                        count: (
                          (billing?.includedCredits ?? 0) -
                          (billing?.usageThisPeriod ?? 0)
                        ).toLocaleString(),
                      })
                    : t("pages.dashboard.usage.includedExhausted")}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {t("pages.dashboard.usage.additionalUsage")}
                  </span>
                  <span>
                    {currentOverage.toLocaleString()}
                    {hasOverageLimit &&
                      ` / ${billing!.overageLimit!.toLocaleString()}`}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  {currentOverage > 0 && (
                    <div
                      className={`h-full transition-all rounded-full ${isOverageAtLimit ? "bg-red-500" : "bg-orange-500"}`}
                      style={{
                        width: hasOverageLimit
                          ? `${Math.min(100, (currentOverage / billing!.overageLimit!) * 100)}%`
                          : `${Math.min(100, (currentOverage / (billing?.includedCredits ?? 1)) * 100)}%`,
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentOverage > 0
                    ? isOverageAtLimit
                      ? t("pages.dashboard.usage.limitReached")
                      : t("pages.dashboard.usage.billedEndOfPeriod")
                    : t("pages.dashboard.usage.noOverageYet")}
                </p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {t("pages.billing.overageLimitTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hasOverageLimit
                        ? t("pages.billing.limitSet", {
                            count: billing!.overageLimit!.toLocaleString(),
                          })
                        : t("pages.billing.unlimitedOverage")}
                    </p>
                  </div>
                  {isEditingLimit ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder={t("pages.billing.noLimitPlaceholder")}
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        className="w-32 h-8"
                        disabled={isSavingLimit}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveLimit}
                        disabled={isSavingLimit}
                      >
                        {isSavingLimit ? t("common.saving") : t("common.save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEditLimit}
                        disabled={isSavingLimit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {hasOverageLimit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleRemoveLimit}
                          disabled={isSavingLimit}
                        >
                          {t("pages.billing.removeLimit")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartEditLimit}
                        disabled={isSavingLimit}
                      >
                        <Pencil className="mr-2 h-3 w-3" />
                        {hasOverageLimit
                          ? t("pages.billing.changeLimit")
                          : t("pages.billing.setLimit")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isPro && (
          <Card>
            <CardHeader>
              <CardTitle>{t("pages.billing.planFeaturesTitle")}</CardTitle>
              <CardDescription>
                {t("pages.billing.planFeaturesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">
                      {t("pages.billing.includedUsageFeature")}
                    </span>
                    <p className="text-muted-foreground">
                      {t("pages.billing.includedUsageFeatureDesc")}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">
                      {t("pages.billing.overageFeature")}
                    </span>
                    <p className="text-muted-foreground">
                      {t("pages.billing.overageFeatureDesc")}
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </InsetLayout>
  );
}
