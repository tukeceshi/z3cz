import type {
  PlatformVideoModelBaseline,
  SingleModelCapabilityLimits,
  SingleModelFormatTransform,
} from "@dafthunk/types";
import {
  describeFormatTransformTemplateRules,
  resolveEffectiveDurationField,
  resolveEffectiveReferenceCounts,
  resolveEffectiveResolutionField,
} from "@dafthunk/types";
import { Settings } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

import {
  formatAdminGenerationOptionLabel,
  resolveDefaultDurationFromField,
  resolveMaxDurationFromField,
  resolveMinDurationFromField,
  useGenerationOptionLabels,
} from "../admin/admin-generation-field-editors";

function PreviewSettingsButton(props: {
  readonly onOpenSettings?: () => void;
  readonly ariaLabel: string;
}) {
  if (!props.onOpenSettings) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      onClick={props.onOpenSettings}
      aria-label={props.ariaLabel}
    >
      <Settings className="size-4" />
    </Button>
  );
}

interface SingleModelCapabilityLimitsPreviewProps {
  readonly platformBaseline: PlatformVideoModelBaseline | null;
  readonly capabilityLimits: SingleModelCapabilityLimits | null;
  readonly onOpenSettings?: () => void;
}

export function SingleModelCapabilityLimitsPreview(
  props: SingleModelCapabilityLimitsPreviewProps
) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();
  const settingsLabel = t(
    "pages.aiInterfaces.singleModel.capabilityLimitsSettingsTitle"
  );

  const effectiveCancel =
    props.platformBaseline?.supportsTaskCancel === false
      ? false
      : (props.capabilityLimits?.supportsTaskCancel ??
          props.platformBaseline?.supportsTaskCancel) !== false;
  const resolutionField = resolveEffectiveResolutionField({
    platformBaseline: props.platformBaseline,
    capabilityLimits: props.capabilityLimits,
  });
  const durationField = resolveEffectiveDurationField({
    platformBaseline: props.platformBaseline,
    capabilityLimits: props.capabilityLimits,
  });
  const referenceCounts = props.platformBaseline
    ? resolveEffectiveReferenceCounts({
        platformBaseline: props.platformBaseline,
        capabilityLimits: props.capabilityLimits,
      })
    : null;
  const defaultResolution = String(resolutionField?.default ?? "");
  const resolutionLabels = (resolutionField?.enumValues ?? []).map((resolution) => {
    const label = formatAdminGenerationOptionLabel(
      "resolution",
      resolution,
      optionLabels
    );
    if (defaultResolution === resolution) {
      return `${label} (${t("pages.adminAiModels.defaultStateLabel")})`;
    }
    return label;
  });
  const durationPreview = durationField
    ? t("pages.aiInterfaces.singleModel.durationLimitsPreview", {
        min: resolveMinDurationFromField(durationField),
        max: resolveMaxDurationFromField(durationField),
        default: resolveDefaultDurationFromField(durationField),
      })
    : null;

  return (
    <div className="bg-muted/40 rounded-md border p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground font-medium">
          {t("pages.aiInterfaces.singleModel.capabilityLimitsTitle")}
        </p>
        <PreviewSettingsButton
          onOpenSettings={props.onOpenSettings}
          ariaLabel={settingsLabel}
        />
      </div>
      <ul className="text-muted-foreground mt-2 space-y-1">
        <li>
          {t("pages.aiInterfaces.singleModel.supportsTaskCancel")}：
          {effectiveCancel
            ? t("pages.aiInterfaces.singleModel.formatTemplateRulesYes")
            : t("pages.aiInterfaces.singleModel.formatTemplateRulesNo")}
        </li>
        {resolutionField ? (
          <li>
            {t("pages.adminAiModels.videoFieldLabels.resolution")}：
            {resolutionLabels.join(", ") ||
              t("pages.aiInterfaces.singleModel.formatTemplateRulesNone")}
          </li>
        ) : null}
        {referenceCounts ? (
          <li>
            {t("pages.aiInterfaces.singleModel.referenceLimitsTitle")}：
            {t("pages.aiInterfaces.singleModel.referenceLimitsPreview", {
              images: referenceCounts.maxReferenceImages,
              videos: referenceCounts.maxReferenceVideos,
              audios: referenceCounts.maxReferenceAudios,
            })}
          </li>
        ) : null}
        {durationPreview ? (
          <li>
            {t("pages.adminAiModels.videoDurationLabel")}：{durationPreview}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

interface SingleModelFormatMappingPreviewProps {
  readonly formatTransform: SingleModelFormatTransform | null;
  readonly onOpenSettings?: () => void;
}

export function SingleModelFormatMappingPreview(
  props: SingleModelFormatMappingPreviewProps
) {
  const { t } = useTranslation();
  const settingsLabel = t(
    "pages.aiInterfaces.singleModel.formatMappingSettingsTitle"
  );

  if (!props.formatTransform) {
    return (
      <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border p-3 text-xs">
        <p className="text-muted-foreground">
          {t("pages.aiInterfaces.singleModel.formatTransformNotConfigured")}
        </p>
        <PreviewSettingsButton
          onOpenSettings={props.onOpenSettings}
          ariaLabel={settingsLabel}
        />
      </div>
    );
  }

  const rules = describeFormatTransformTemplateRules(props.formatTransform);

  return (
    <div className="bg-muted/40 space-y-2 rounded-md border p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground font-medium">
          {t("pages.aiInterfaces.singleModel.formatMappingTitle")}
        </p>
        <PreviewSettingsButton
          onOpenSettings={props.onOpenSettings}
          ariaLabel={settingsLabel}
        />
      </div>
      {rules.mappings.length > 0 ? (
        <ul className="text-muted-foreground space-y-1 font-mono">
          {rules.mappings.map((mapping) => (
            <li key={`${mapping.upstreamParamName}:${mapping.sourceLabel}`}>
              <span className="text-foreground">{mapping.upstreamParamName}</span>
              <span className="text-muted-foreground"> ← </span>
              <span className="text-foreground">{mapping.sourceLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          {t("pages.aiInterfaces.singleModel.formatTemplateRulesNone")}
        </p>
      )}
    </div>
  );
}
