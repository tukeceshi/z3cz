import { Link } from "react-router";
import X from "lucide-react/icons/x";

import type { CloudStorageBlockReason } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useOrgUrl } from "@/hooks/use-org-url";
import { cn } from "@/utils/utils";

interface AiCloudStorageBannerProps {
  readonly visible: boolean;
  readonly variant: "not_configured" | "degraded" | "unhealthy" | "auto_fixing";
  readonly reason?: CloudStorageBlockReason | null;
  readonly showConfigureAction?: boolean;
  readonly onDismiss?: () => void;
}

const REASON_TITLE_KEYS: Partial<
  Record<CloudStorageBlockReason, TranslationKey>
> = {
  service_not_opened: "workflow.aiCloudStorageBanner.unhealthy.serviceNotOpened",
  auth_invalid: "workflow.aiCloudStorageBanner.unhealthy.authInvalid",
  bucket_missing: "workflow.aiCloudStorageBanner.unhealthy.bucketMissing",
  quota_exceeded: "workflow.aiCloudStorageBanner.unhealthy.quotaExceeded",
  account_suspended: "workflow.aiCloudStorageBanner.unhealthy.accountSuspended",
  permission_denied: "workflow.aiCloudStorageBanner.unhealthy.permissionDenied",
  cors_not_configured: "workflow.aiCloudStorageBanner.unhealthy.corsNotConfigured",
};

const REASON_DESCRIPTION_KEYS: Partial<
  Record<CloudStorageBlockReason, TranslationKey>
> = {
  service_not_opened:
    "workflow.aiCloudStorageBanner.unhealthy.serviceNotOpenedDescription",
  auth_invalid:
    "workflow.aiCloudStorageBanner.unhealthy.authInvalidDescription",
  bucket_missing:
    "workflow.aiCloudStorageBanner.unhealthy.bucketMissingDescription",
  quota_exceeded:
    "workflow.aiCloudStorageBanner.unhealthy.quotaExceededDescription",
  account_suspended:
    "workflow.aiCloudStorageBanner.unhealthy.accountSuspendedDescription",
  permission_denied:
    "workflow.aiCloudStorageBanner.unhealthy.permissionDeniedDescription",
  cors_not_configured:
    "workflow.aiCloudStorageBanner.unhealthy.corsNotConfiguredDescription",
};

export function AiCloudStorageBanner({
  visible,
  variant,
  reason,
  showConfigureAction = true,
  onDismiss,
}: AiCloudStorageBannerProps) {
  const { t } = useTranslation();
  const { getOrgUrl } = useOrgUrl();

  if (!visible) return null;

  const title =
    variant === "auto_fixing"
      ? t("workflow.aiCloudStorageBanner.autoFixing.title")
      : variant === "not_configured"
      ? t("workflow.aiCloudStorageBanner.title")
      : variant === "degraded"
        ? t("workflow.aiCloudStorageBanner.degraded.title")
        : t(
            REASON_TITLE_KEYS[reason ?? "permission_denied"] ??
              "workflow.aiCloudStorageBanner.unhealthy.title"
          );

  const description =
    variant === "auto_fixing"
      ? t("workflow.aiCloudStorageBanner.autoFixing.description")
      : variant === "not_configured"
      ? t("workflow.aiCloudStorageBanner.description")
      : variant === "degraded"
        ? t("workflow.aiCloudStorageBanner.degraded.description")
        : t(
            REASON_DESCRIPTION_KEYS[reason ?? "permission_denied"] ??
              "workflow.aiCloudStorageBanner.unhealthy.description"
          );

  const bannerClassName =
    variant === "degraded"
      ? "absolute top-0 left-0 right-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2 dark:border-amber-900 dark:bg-amber-950/40"
      : variant === "auto_fixing"
        ? "absolute top-0 left-0 right-0 z-50 border-b border-blue-300 bg-blue-50 px-4 py-2 dark:border-blue-900 dark:bg-blue-950/40"
      : "absolute top-0 left-0 right-0 z-50 border-b border-red-300 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950/40";

  const textClassName =
    variant === "degraded"
      ? "space-y-1 text-sm text-amber-900 dark:text-amber-100"
      : variant === "auto_fixing"
        ? "space-y-1 text-sm text-blue-900 dark:text-blue-100"
      : "space-y-1 text-sm text-red-900 dark:text-red-100";

  const bodyTextClassName =
    variant === "degraded"
      ? "text-amber-800/90 dark:text-amber-200/90"
      : variant === "auto_fixing"
        ? "text-blue-800/90 dark:text-blue-200/90"
      : "text-red-800/90 dark:text-red-200/90";

  const dismissClassName =
    variant === "degraded"
      ? "rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
      : variant === "auto_fixing"
        ? "rounded p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/50"
      : "rounded p-1 text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50";

  return (
    <div className={bannerClassName}>
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <div className={textClassName}>
          <p className="font-medium">{title}</p>
          <p className={bodyTextClassName}>{description}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {showConfigureAction ? (
              <Button asChild size="sm" variant="outline" className="h-7">
                <Link to={getOrgUrl("/ai-interfaces")}>
                  {t("workflow.aiCloudStorageBanner.configure")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(dismissClassName)}
            aria-label={t("workflow.execution.close")}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
