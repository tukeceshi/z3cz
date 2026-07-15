import type {
  ModelActivationStatus,
  VolcanoModelSnapshotRow,
  VolcanoSnapshotPricingRow,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getVolcanoEffectiveActivationStatus } from "@/utils/volcano-activation";
import { cn } from "@/utils/utils";

import { VolcanoPricingPopover } from "./volcano-pricing-popover";
import { VolcanoUsageMeter } from "./volcano-usage-meter";

const OPEN_MANAGEMENT_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/openManagement";

interface VolcanoModelRowProps {
  row: VolcanoModelSnapshotRow;
  disabled?: boolean;
  showUsage?: boolean;
  hintVariant?: "panel" | "wizard";
  pricingRow?: VolcanoSnapshotPricingRow | null;
  pricingDocUrl?: string;
  onEnabledChange?: (enabled: boolean) => void;
}

function activationBadgeVariant(
  status: ModelActivationStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "invalid_model_id") return "destructive";
  if (status === "not_open" || status === "service_not_open") return "secondary";
  return "outline";
}

function isWizardBlockingActivation(
  status: ModelActivationStatus | null
): boolean {
  return (
    status === "not_open" ||
    status === "service_not_open" ||
    status === "invalid_model_id" ||
    status === "unknown"
  );
}

export function VolcanoModelRow({
  row,
  disabled = false,
  showUsage = true,
  hintVariant = "panel",
  pricingRow = null,
  pricingDocUrl,
  onEnabledChange,
}: VolcanoModelRowProps) {
  const { t } = useTranslation();
  const modalityShort = t(
    `pages.aiInterfaces.volcano.modalityShort.${row.modality}`
  );
  const effectiveActivation = getVolcanoEffectiveActivationStatus(row);
  const showActivationBadge =
    effectiveActivation === "not_open" ||
    effectiveActivation === "service_not_open" ||
    effectiveActivation === "invalid_model_id" ||
    effectiveActivation === "unknown";
  const wizardBlocking =
    hintVariant === "wizard" && isWizardBlockingActivation(effectiveActivation);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Switch
          checked={row.enabled}
          disabled={disabled || !onEnabledChange}
          onCheckedChange={(checked) => onEnabledChange?.(checked)}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {row.alias}（{modalityShort}）
            </span>
            {showActivationBadge && effectiveActivation ? (
              <Badge variant={activationBadgeVariant(effectiveActivation)}>
                {t(`pages.aiInterfaces.volcano.activation.${effectiveActivation}`)}
              </Badge>
            ) : null}
            {pricingRow && pricingDocUrl ? (
              <VolcanoPricingPopover pricing={pricingRow} docUrl={pricingDocUrl} />
            ) : null}
          </div>
          <span className="text-muted-foreground block text-xs font-mono">
            {row.providerModelId}
          </span>

          {wizardBlocking ? (
            <p className="text-muted-foreground text-xs">
              {t("pages.aiInterfaces.volcano.activation.wizardDeferredEnable")}
            </p>
          ) : null}

          {!wizardBlocking &&
          (effectiveActivation === "not_open" ||
            effectiveActivation === "service_not_open") ? (
            <p className="text-muted-foreground text-xs">
              {t("pages.aiInterfaces.volcano.activation.openConsole")}{" "}
              <a
                href={OPEN_MANAGEMENT_URL}
                target="_blank"
                rel="noreferrer"
                className={cn("text-primary underline-offset-4 hover:underline")}
              >
                {t("pages.aiInterfaces.volcano.openManagement")}
              </a>
            </p>
          ) : null}

          {!row.enabled && !wizardBlocking ? (
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.disabledHint")}
            </p>
          ) : showUsage && row.usage ? (
            <VolcanoUsageMeter usage={row.usage} />
          ) : showUsage && row.usageError ? (
            <p className="text-muted-foreground text-sm">{row.usageError}</p>
          ) : showUsage && !row.usage ? (
            <p className="text-muted-foreground text-xs">
              {t("pages.aiInterfaces.volcano.meteredBillingOnly")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
