import type {
  ModelActivationStatus,
  VolcanoModelSnapshotRow,
  VolcanoSnapshotPricingRow,
} from "@dafthunk/types";
import { formatPlatformModelLabel } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getVolcanoEffectiveActivationStatus, isVolcanoModelActivationBlocking } from "@/utils/volcano-activation";

import { VolcanoPricingPopover } from "./volcano-pricing-popover";
import { VolcanoUsageMeter } from "./volcano-usage-meter";

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
  if (status === "open") return "default";
  if (status === "invalid_model_id") return "destructive";
  if (status === "not_open" || status === "service_not_open") return "secondary";
  return "outline";
}

function wizardDisplayStatus(
  status: ModelActivationStatus | null
): "open" | "not_open" {
  return status === "open" ? "open" : "not_open";
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
  const modelLabel = formatPlatformModelLabel({
    alias: row.alias,
    modalityLabel: modalityShort,
  });
  const isWizard = hintVariant === "wizard";
  const effectiveActivation = getVolcanoEffectiveActivationStatus(row);
  const enableBlocked = !isWizard && isVolcanoModelActivationBlocking(row);
  const wizardStatus = isWizard
    ? wizardDisplayStatus(effectiveActivation)
    : null;
  const showActivationBadge = isWizard
    ? true
    : effectiveActivation === "not_open" ||
      effectiveActivation === "service_not_open" ||
      effectiveActivation === "invalid_model_id" ||
      effectiveActivation === "unknown";
  const badgeStatus = isWizard ? wizardStatus! : effectiveActivation;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Switch
          checked={row.enabled}
          disabled={disabled || !onEnabledChange}
          onCheckedChange={(checked) => {
            if (checked && enableBlocked) {
              return;
            }
            onEnabledChange?.(checked);
          }}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{modelLabel}</span>
            {showActivationBadge && badgeStatus ? (
              <Badge
                variant={
                  isWizard && badgeStatus === "open"
                    ? "translucent-success"
                    : activationBadgeVariant(badgeStatus)
                }
              >
                {t(`pages.aiInterfaces.volcano.activation.${badgeStatus}`)}
              </Badge>
            ) : null}
            {!isWizard && pricingRow && pricingDocUrl ? (
              <VolcanoPricingPopover pricing={pricingRow} docUrl={pricingDocUrl} />
            ) : null}
          </div>
          <span className="text-muted-foreground block text-xs font-mono">
            {row.providerModelId}
          </span>

          {!isWizard && !row.enabled ? (
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.disabledHint")}
            </p>
          ) : null}
          {showUsage && row.usage ? (
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
