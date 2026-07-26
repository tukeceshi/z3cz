import type { VolcanoTosServiceStatus } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";

import { Button } from "@/components/ui/button";

import { VolcanoArkNotOpenedGuide } from "./volcano-ark-not-opened-guide";
import {
  VolcanoTosAuthErrorGuide,
  VOLCANO_TOS_CONSOLE_URL,
} from "./volcano-tos-not-opened-guide";

const OPEN_MANAGEMENT_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/openManagement";

const linkClassName =
  "text-primary underline-offset-4 hover:underline font-medium";

function SetupBanner({
  children,
  compact = false,
}: {
  readonly children: React.ReactNode;
  readonly compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "text-muted-foreground text-xs leading-relaxed"
          : "rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed"
      }
    >
      {children}
    </div>
  );
}

interface VolcanoWizardSetupBannersProps {
  readonly notOpenModelCount: number;
}

export function VolcanoWizardSetupBanners({
  notOpenModelCount,
}: VolcanoWizardSetupBannersProps) {
  const { t } = useTranslation();

  if (notOpenModelCount <= 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <SetupBanner>
        <p className="text-muted-foreground">
          {t("pages.aiInterfaces.volcano.activation.wizardNotOpenHint")}
        </p>
      </SetupBanner>
    </div>
  );
}

interface VolcanoPanelSetupBannersProps {
  readonly arkNotOpened: boolean;
  readonly notOpenModelCount: number;
  readonly tosServiceStatus: VolcanoTosServiceStatus | null;
  readonly isProbingTos: boolean;
  readonly skipTosHints: boolean;
  readonly compact?: boolean;
  readonly onRetryTos?: () => void;
}

export function VolcanoPanelSetupBanners({
  arkNotOpened,
  notOpenModelCount,
  tosServiceStatus,
  isProbingTos,
  skipTosHints,
  compact = false,
  onRetryTos,
}: VolcanoPanelSetupBannersProps) {
  const { t } = useTranslation();

  const showTosNotOpened =
    !compact && !skipTosHints && tosServiceStatus === "not_opened";
  const showTosAuthError =
    !compact && !skipTosHints && tosServiceStatus === "auth_error";
  const showModelsNotOpen = !compact && notOpenModelCount > 0;

  if (
    !arkNotOpened &&
    !showTosNotOpened &&
    !showTosAuthError &&
    !showModelsNotOpen &&
    !(isProbingTos && !skipTosHints)
  ) {
    return null;
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {isProbingTos && !skipTosHints ? (
        <SetupBanner compact={compact}>
          <p>{t("pages.aiInterfaces.tosStorage.probing")}</p>
        </SetupBanner>
      ) : null}
      {arkNotOpened ? (
        <SetupBanner compact={compact}>
          <VolcanoArkNotOpenedGuide />
        </SetupBanner>
      ) : null}
      {showModelsNotOpen ? (
        <SetupBanner compact={compact}>
          <p>
            {t("pages.aiInterfaces.volcano.activation.panelNotOpenHint", {
              count: notOpenModelCount,
            })}{" "}
            <a
              href={OPEN_MANAGEMENT_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClassName}
            >
              {t("pages.aiInterfaces.volcano.openManagement")}
            </a>
            {t("pages.aiInterfaces.volcano.activation.panelNotOpenHintAfterLink")}
          </p>
        </SetupBanner>
      ) : null}
      {showTosNotOpened ? (
        <SetupBanner compact={compact}>
          <p>
            {t("pages.aiInterfaces.volcano.activation.panelTosNotOpenHint")}{" "}
            <a
              href={VOLCANO_TOS_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClassName}
            >
              {t("pages.aiInterfaces.tosStorage.notOpened.link")}
            </a>
            {t("pages.aiInterfaces.volcano.activation.panelTosNotOpenHintAfterLink")}
          </p>
        </SetupBanner>
      ) : null}
      {showTosAuthError ? (
        <SetupBanner compact={compact}>
          <VolcanoTosAuthErrorGuide compact={compact} />
          {onRetryTos ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={isProbingTos}
              onClick={onRetryTos}
            >
              {t("pages.aiInterfaces.volcano.activation.probeRetry")}
            </Button>
          ) : null}
        </SetupBanner>
      ) : null}
    </div>
  );
}
