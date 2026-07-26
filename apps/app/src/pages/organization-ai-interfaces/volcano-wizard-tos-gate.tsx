import type { VolcanoTosServiceStatus } from "@dafthunk/types";
import Loader2 from "lucide-react/icons/loader-2";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

import {
  VolcanoTosAuthErrorGuide,
  VolcanoTosNotOpenedGuide,
} from "./volcano-tos-not-opened-guide";

export type VolcanoWizardTosGateMode =
  | "probing"
  | "not_opened"
  | "auth_error";

interface VolcanoWizardTosGateProps {
  readonly mode: VolcanoWizardTosGateMode;
  readonly isRetrying?: boolean;
  readonly onRetry: () => void;
  readonly onSkip: () => void;
}

export function resolveVolcanoWizardTosGateMode(
  probePhase: string,
  tosServiceStatus: VolcanoTosServiceStatus | null
): VolcanoWizardTosGateMode | null {
  if (probePhase === "tos_auth_error" || tosServiceStatus === "auth_error") {
    return "auth_error";
  }
  if (probePhase === "tos_not_opened" || tosServiceStatus === "not_opened") {
    return "not_opened";
  }
  if (probePhase === "probing_tos") {
    return "probing";
  }
  return null;
}

export function isVolcanoWizardTosGatePhase(probePhase: string): boolean {
  return (
    probePhase === "probing_tos" ||
    probePhase === "tos_not_opened" ||
    probePhase === "tos_auth_error"
  );
}

export function VolcanoWizardTosGate({
  mode,
  isRetrying = false,
  onRetry,
  onSkip,
}: VolcanoWizardTosGateProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      {mode === "probing" ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          {t("pages.aiInterfaces.tosStorage.probing")}
        </div>
      ) : null}
      {mode === "not_opened" ? <VolcanoTosNotOpenedGuide /> : null}
      {mode === "auth_error" ? <VolcanoTosAuthErrorGuide /> : null}
      {mode !== "probing" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRetrying}
            onClick={onRetry}
          >
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("pages.aiInterfaces.tosStorage.probing")}
              </>
            ) : (
              t("pages.aiInterfaces.volcano.activation.probeRetry")
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {t("pages.aiInterfaces.tosStorage.wizardSkip")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
