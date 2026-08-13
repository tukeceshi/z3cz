import type {
  PlatformVideoModelBaseline,
  SingleModelCapabilityLimits,
  UpstreamParamProfileField,
} from "@dafthunk/types";

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
import { SettingsSection } from "../admin/admin-ai-models-ui";

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

function parseReferenceCountInput(
  value: string,
  fallback: number,
  max: number
): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
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
    </div>
  );
}
