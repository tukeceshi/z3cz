import type {
  PlatformVideoModelBaseline,
  SingleModelCapabilityLimits,
  UpstreamParamProfileField,
} from "@dafthunk/types";
import {
  formatVideoPricePromoFold,
  isVideoPricePromoFold,
  isVideoPricePromoFoldDraft,
  normalizeVideoPricePromoFold,
} from "@dafthunk/types";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { CredentialPlainInput } from "@/components/credential-secret-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNumericDraftInput } from "@/hooks/use-numeric-draft-input";

import {
  AdminGenerationOptionChip,
  formatAdminGenerationOptionLabel,
  resolveMaxDurationFromField,
  resolveMinDurationFromField,
  useGenerationOptionLabels,
  VideoDurationEditor,
  type GenerationOptionLabels,
} from "../admin/admin-generation-field-editors";
import {
  ADMIN_PARAM_HINT_CLASS,
  SettingsSection,
} from "../admin/admin-ai-models-ui";

interface OrgCapabilityLimitsEditorProps {
  readonly platformBaseline: PlatformVideoModelBaseline | null;
  readonly capabilityLimits: SingleModelCapabilityLimits;
  readonly onCapabilityLimitsChange: (
    limits: SingleModelCapabilityLimits
  ) => void;
}

function orderEnabledEnumValues(
  enabledValues: readonly string[],
  allowedOptions: readonly string[]
): string[] {
  const enabled = new Set(enabledValues);
  return allowedOptions.filter((option) => enabled.has(option));
}

function OrgGenerationEnumChips(props: {
  readonly field: UpstreamParamProfileField;
  readonly allowedOptions: readonly string[];
  readonly optionLabels: GenerationOptionLabels;
  readonly onChange: (next: UpstreamParamProfileField) => void;
}) {
  const enabled = new Set(props.field.enumValues ?? []);
  const defaultValue = String(props.field.default ?? "");

  const handleClick = (option: string) => {
    const isEnabled = enabled.has(option);
    const isDefault = defaultValue === option;

    if (!isEnabled) {
      props.onChange({
        ...props.field,
        enumValues: orderEnabledEnumValues(
          [...(props.field.enumValues ?? []), option],
          props.allowedOptions
        ),
        default:
          props.field.default === undefined ? option : props.field.default,
      });
      return;
    }

    if (!isDefault) {
      props.onChange({
        ...props.field,
        default: option,
      });
      return;
    }

    if ((props.field.enumValues?.length ?? 0) <= 1) {
      return;
    }

    const nextEnabled = orderEnabledEnumValues(
      (props.field.enumValues ?? []).filter((entry) => entry !== option),
      props.allowedOptions
    );
    props.onChange({
      ...props.field,
      enumValues: nextEnabled,
      default: nextEnabled[0],
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {props.allowedOptions.map((option) => {
        const isEnabled = enabled.has(option);
        const isDefault = isEnabled && defaultValue === option;
        const label = formatAdminGenerationOptionLabel(
          props.field.name,
          option,
          props.optionLabels
        );
        return (
          <AdminGenerationOptionChip
            key={option}
            label={label}
            enabled={isEnabled}
            isDefault={isDefault}
            onClick={() => handleClick(option)}
          />
        );
      })}
    </div>
  );
}

function withoutPriceEstimateDiscountFold(
  limits: SingleModelCapabilityLimits
): SingleModelCapabilityLimits {
  const { priceEstimateDiscountFold: _removed, ...rest } = limits;
  return rest;
}

function withoutApplyOfficialPriceDiscount(
  limits: SingleModelCapabilityLimits
): SingleModelCapabilityLimits {
  const { applyOfficialPriceDiscount: _removed, ...rest } = limits;
  return rest;
}

function OrgPriceEstimateDiscountInput(props: {
  readonly fold: number;
  readonly onCommit: (fold: number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => formatVideoPricePromoFold(props.fold));

  useEffect(() => {
    setDraft(formatVideoPricePromoFold(props.fold));
  }, [props.fold]);

  return (
    <div className="space-y-1">
      <Label htmlFor="org_cap_price_discount_fold">
        {t("pages.adminAiModels.priceEstimatePromoFold")}
      </Label>
      <CredentialPlainInput
        id="org_cap_price_discount_fold"
        name="org_cap_price_discount_fold"
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          if (!isVideoPricePromoFoldDraft(next.trim())) {
            return;
          }
          setDraft(next);
          const parsed = Number(next);
          if (isVideoPricePromoFold(parsed)) {
            props.onCommit(normalizeVideoPricePromoFold(parsed));
          }
        }}
        onBlur={() => {
          if (isVideoPricePromoFold(Number(draft))) {
            setDraft(formatVideoPricePromoFold(Number(draft)));
            return;
          }
          setDraft(formatVideoPricePromoFold(props.fold));
        }}
      />
    </div>
  );
}

function OrgPriceEstimateSection(props: {
  readonly platformBaseline: PlatformVideoModelBaseline;
  readonly capabilityLimits: SingleModelCapabilityLimits;
  readonly onCapabilityLimitsChange: (limits: SingleModelCapabilityLimits) => void;
}) {
  const { t } = useTranslation();
  const config = props.platformBaseline.priceEstimate;
  if (config?.enabled !== true) {
    return null;
  }

  const orgFold = props.capabilityLimits.priceEstimateDiscountFold;
  const discountEnabled = orgFold !== undefined;
  const officialEnabled =
    props.capabilityLimits.applyOfficialPriceDiscount !== false;

  return (
    <SettingsSection
      compact
      stacked
      title={t("pages.aiInterfaces.singleModel.priceEstimateTitle")}
      action={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t("pages.aiInterfaces.singleModel.priceEstimateOfficialDiscount")}
            </span>
            <Switch
              checked={officialEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  props.onCapabilityLimitsChange(
                    withoutApplyOfficialPriceDiscount(props.capabilityLimits)
                  );
                  return;
                }
                props.onCapabilityLimitsChange({
                  ...props.capabilityLimits,
                  applyOfficialPriceDiscount: false,
                });
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t("pages.aiInterfaces.singleModel.priceEstimateExtraDiscount")}
            </span>
            <Switch
              checked={discountEnabled}
              onCheckedChange={(checked) => {
                if (!checked) {
                  props.onCapabilityLimitsChange(
                    withoutPriceEstimateDiscountFold(props.capabilityLimits)
                  );
                  return;
                }
                props.onCapabilityLimitsChange({
                  ...props.capabilityLimits,
                  priceEstimateDiscountFold: 8,
                });
              }}
            />
          </div>
        </div>
      }
    >
      {discountEnabled && orgFold !== undefined ? (
        <OrgPriceEstimateDiscountInput
          fold={orgFold}
          onCommit={(priceEstimateDiscountFold) =>
            props.onCapabilityLimitsChange({
              ...props.capabilityLimits,
              priceEstimateDiscountFold,
            })
          }
        />
      ) : null}
      <p className={ADMIN_PARAM_HINT_CLASS}>
        {t("pages.aiInterfaces.singleModel.priceEstimateExtraDiscountHint")}
      </p>
    </SettingsSection>
  );
}

function OrgReferenceCountInput(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly onCommit: (value: number) => void;
}) {
  const { t } = useTranslation();
  const inputProps = useNumericDraftInput({
    value: props.value,
    min: 0,
    max: props.max,
    onCommit: props.onCommit,
  });

  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <CredentialPlainInput
        id={props.id}
        name={props.name}
        inputMode="numeric"
        {...inputProps}
      />
      <p className="text-muted-foreground text-xs">
        {t("pages.aiInterfaces.singleModel.platformLimitHint", {
          max: props.max,
        })}
      </p>
    </div>
  );
}

export function OrgCapabilityLimitsEditor({
  platformBaseline,
  capabilityLimits,
  onCapabilityLimitsChange,
}: OrgCapabilityLimitsEditorProps) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();

  if (!platformBaseline) {
    return null;
  }

  const resolutionField =
    capabilityLimits.resolution ?? platformBaseline.resolution ?? null;
  const resolutionOptions = platformBaseline.resolution?.enumValues ?? [];
  const durationField =
    capabilityLimits.duration ?? platformBaseline.duration ?? null;

  return (
    <div className="space-y-3">
      {platformBaseline.supportsTaskCancel ? (
        <SettingsSection
          compact
          columns={1}
          title={t("pages.aiInterfaces.singleModel.supportsTaskCancel")}
          action={
            <Switch
              checked={capabilityLimits.supportsTaskCancel !== false}
              onCheckedChange={(checked) =>
                onCapabilityLimitsChange({
                  ...capabilityLimits,
                  supportsTaskCancel: checked,
                })
              }
            />
          }
        />
      ) : (
        <SettingsSection
          compact
          columns={1}
          title={t("pages.aiInterfaces.singleModel.supportsTaskCancel")}
        >
          <p className="text-muted-foreground text-xs">
            {t("pages.aiInterfaces.singleModel.platformCancelDisabled")}
          </p>
        </SettingsSection>
      )}

      {resolutionField && resolutionOptions.length > 0 ? (
        <SettingsSection
          compact
          stacked
          columns={1}
          title={t("pages.adminAiModels.videoFieldLabels.resolution")}
        >
          <OrgGenerationEnumChips
            field={resolutionField}
            allowedOptions={resolutionOptions}
            optionLabels={optionLabels}
            onChange={(next) =>
              onCapabilityLimitsChange({
                ...capabilityLimits,
                resolution: next,
              })
            }
          />
        </SettingsSection>
      ) : null}

      <SettingsSection compact stacked columns={1} title={t("pages.aiInterfaces.singleModel.referenceLimitsTitle")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <OrgReferenceCountInput
            id="org_cap_ref_images"
            name="org_cap_ref_images"
            label={t("pages.aiInterfaces.singleModel.maxReferenceImages")}
            value={
              capabilityLimits.maxReferenceImages ??
              platformBaseline.maxReferenceImages
            }
            max={platformBaseline.maxReferenceImages}
            onCommit={(maxReferenceImages) =>
              onCapabilityLimitsChange({
                ...capabilityLimits,
                maxReferenceImages,
              })
            }
          />
          <OrgReferenceCountInput
            id="org_cap_ref_videos"
            name="org_cap_ref_videos"
            label={t("pages.aiInterfaces.singleModel.maxReferenceVideos")}
            value={
              capabilityLimits.maxReferenceVideos ??
              platformBaseline.maxReferenceVideos
            }
            max={platformBaseline.maxReferenceVideos}
            onCommit={(maxReferenceVideos) =>
              onCapabilityLimitsChange({
                ...capabilityLimits,
                maxReferenceVideos,
              })
            }
          />
          <OrgReferenceCountInput
            id="org_cap_ref_audios"
            name="org_cap_ref_audios"
            label={t("pages.aiInterfaces.singleModel.maxReferenceAudios")}
            value={
              capabilityLimits.maxReferenceAudios ??
              platformBaseline.maxReferenceAudios
            }
            max={platformBaseline.maxReferenceAudios}
            onCommit={(maxReferenceAudios) =>
              onCapabilityLimitsChange({
                ...capabilityLimits,
                maxReferenceAudios,
              })
            }
          />
        </div>
      </SettingsSection>

      {durationField && platformBaseline.duration ? (
        <SettingsSection
          compact
          stacked
          columns={1}
          title={t("pages.adminAiModels.videoDurationLabel")}
        >
          <VideoDurationEditor
            fields={[durationField]}
            platformBounds={{
              min: resolveMinDurationFromField(platformBaseline.duration),
              max: resolveMaxDurationFromField(platformBaseline.duration),
            }}
            onFieldsChange={(fields) => {
              const nextDuration = fields.find((field) => field.name === "duration");
              if (!nextDuration) {
                return;
              }
              onCapabilityLimitsChange({
                ...capabilityLimits,
                duration: nextDuration,
              });
            }}
          />
        </SettingsSection>
      ) : null}

      <OrgPriceEstimateSection
        platformBaseline={platformBaseline}
        capabilityLimits={capabilityLimits}
        onCapabilityLimitsChange={onCapabilityLimitsChange}
      />
    </div>
  );
}
