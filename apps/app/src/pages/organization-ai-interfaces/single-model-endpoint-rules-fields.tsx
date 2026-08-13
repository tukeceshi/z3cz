import type {
  FormatTransformTemplate,
  PlatformVideoModelBaseline,
  SingleModelCapabilityLimits,
  SingleModelFormatTransform,
  SingleModelProviderMetadata,
} from "@dafthunk/types";
import {
  capabilityLimitsFromLegacyFormatTransform,
  listSingleModelMetadataEntries,
  readSingleModelFormatTemplateId,
  singleModelFormatTransformFromTemplate,
} from "@dafthunk/types";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Switch } from "@/components/ui/switch";

import { FormatMappingSettingsDialog } from "./format-mapping-settings-dialog";
import { SingleModelFormatMappingPreview } from "./single-model-rules-preview";

export interface SingleModelEndpointRulesFormState {
  readonly useOfficial: boolean;
  readonly useFullSubmitUrl: boolean;
}

export interface SingleModelVideoFormatTransformModelRow {
  readonly canonicalId: string;
  readonly label: string;
}

/** @deprecated Use split capabilityLimits + sharedFormatTransform state. */
export interface SingleModelRulesFormState {
  readonly capabilityLimits: SingleModelCapabilityLimits | null;
  readonly formatTransform: SingleModelFormatTransform | null;
}

interface SingleModelEndpointRulesFieldsProps {
  readonly category: string;
  readonly value: SingleModelEndpointRulesFormState;
  readonly onChange: (value: SingleModelEndpointRulesFormState) => void;
  readonly idPrefix: string;
  readonly sharedFormatTransform?: SingleModelFormatTransform | null;
  readonly onSharedFormatTransformChange?: (
    value: SingleModelFormatTransform | null
  ) => void;
  readonly formatTemplates?: readonly FormatTransformTemplate[];
  readonly isFormatTemplatesLoading?: boolean;
}

function areFormatTransformsEqual(
  left: SingleModelFormatTransform,
  right: SingleModelFormatTransform
): boolean {
  return (
    left.sourceTemplateId === right.sourceTemplateId &&
    JSON.stringify(left.upstreamParams) === JSON.stringify(right.upstreamParams) &&
    JSON.stringify(left.paramMappings) === JSON.stringify(right.paramMappings)
  );
}

export function singleModelVideoRulesMetadata(params: {
  readonly formatTransform?: SingleModelFormatTransform | null;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}): {
  readonly formatTransform?: SingleModelFormatTransform;
  readonly capabilityLimits?: SingleModelCapabilityLimits;
} {
  if (!params.formatTransform) {
    return {};
  }

  return {
    formatTransform: params.formatTransform,
    ...(params.capabilityLimits
      ? { capabilityLimits: params.capabilityLimits }
      : {}),
  };
}

export function resolveSharedFormatTransformFromRulesMap(
  rulesMap: Readonly<Record<string, SingleModelRulesFormState>>
): SingleModelFormatTransform | null {
  const transforms = Object.values(rulesMap)
    .map((rules) => rules.formatTransform)
    .filter((transform): transform is SingleModelFormatTransform =>
      Boolean(transform)
    );

  if (transforms.length === 0) {
    return null;
  }

  const [first, ...rest] = transforms;
  if (rest.every((transform) => areFormatTransformsEqual(transform, first))) {
    return first;
  }

  return null;
}

export function capabilityLimitsByInstanceIdFromRulesMap(
  rulesMap: Readonly<Record<string, SingleModelRulesFormState>>
): Record<string, SingleModelCapabilityLimits | null> {
  return Object.fromEntries(
    Object.entries(rulesMap).map(([instanceId, rules]) => [
      instanceId,
      rules.capabilityLimits,
    ])
  );
}

/** @deprecated Keys are instanceId; use capabilityLimitsByInstanceIdFromRulesMap */
export const capabilityLimitsByCanonicalIdFromRulesMap =
  capabilityLimitsByInstanceIdFromRulesMap;

export function rulesSettingsFormStateFromMetadata(params: {
  readonly metadata: SingleModelProviderMetadata;
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly platformBaseline: PlatformVideoModelBaseline | null;
  readonly formatTemplates?: readonly FormatTransformTemplate[];
}): SingleModelRulesFormState {
  const config = params.metadata.models[params.instanceId];
  let capabilityLimits = config?.capabilityLimits ?? null;
  let formatTransform = config?.formatTransform ?? null;

  const legacyId = readSingleModelFormatTemplateId(params.metadata);
  if (!formatTransform && legacyId) {
    const legacyTemplate = params.formatTemplates?.find(
      (template) => template.id === legacyId
    );
    if (legacyTemplate) {
      formatTransform = singleModelFormatTransformFromTemplate(legacyTemplate);
    }
  }

  const legacyTransform = formatTransform as
    | (SingleModelFormatTransform & {
        readonly supportsTaskCancel?: boolean;
        readonly lockedResolution?: string | null;
      })
    | null;

  if (!capabilityLimits && legacyTransform && params.platformBaseline?.resolution) {
    const legacyLimits = capabilityLimitsFromLegacyFormatTransform({
      supportsTaskCancel: legacyTransform.supportsTaskCancel,
      lockedResolution: legacyTransform.lockedResolution ?? null,
      platformRules: {
        schemaVersion: 1 as const,
        maxReferenceImages: 0,
        maxImageReferenceBytes: 0,
        maxReferenceVideos: 0,
        maxVideoReferenceBytes: 0,
        maxVideoReferenceSeconds: 0,
        maxReferenceAudios: 0,
        maxAudioReferenceBytes: 0,
        maxAudioReferenceSeconds: 0,
        promptMaxChars: 0,
        supportsTaskCancel: params.platformBaseline.supportsTaskCancel,
        generationFields: [params.platformBaseline.resolution],
      },
    });
    if (legacyLimits) {
      capabilityLimits = legacyLimits;
    }
  }

  return {
    capabilityLimits,
    formatTransform,
  };
}

export function rulesSettingsFormStateFromMetadataMap(params: {
  readonly metadata: SingleModelProviderMetadata;
  readonly platformBaselines: readonly PlatformVideoModelBaseline[];
  readonly formatTemplates?: readonly FormatTransformTemplate[];
}): Record<string, SingleModelRulesFormState> {
  const baselineById = new Map(
    params.platformBaselines.map((baseline) => [baseline.canonicalId, baseline])
  );

  return Object.fromEntries(
    listSingleModelMetadataEntries(params.metadata)
      .filter(({ config }) => config.enabled && config.modality === "video")
      .map(({ instanceId, canonicalId }) => [
        instanceId,
        rulesSettingsFormStateFromMetadata({
          metadata: params.metadata,
          instanceId,
          canonicalId,
          platformBaseline: baselineById.get(canonicalId) ?? null,
          formatTemplates: params.formatTemplates,
        }),
      ])
  );
}

export function videoFormatTransformModelRowsFromMetadata(
  metadata: SingleModelProviderMetadata,
  labelForCanonicalId: (canonicalId: string) => string
): SingleModelVideoFormatTransformModelRow[] {
  return listSingleModelMetadataEntries(metadata)
    .filter(({ config }) => config.enabled && config.modality === "video")
    .map(({ canonicalId }) => ({
      canonicalId,
      label: labelForCanonicalId(canonicalId),
    }));
}

export function createDefaultEndpointRulesFormState(): SingleModelEndpointRulesFormState {
  return {
    useOfficial: true,
    useFullSubmitUrl: false,
  };
}

export function endpointRulesFormStateFromMetadata(params: {
  readonly endpointRules?: {
    readonly useOfficial?: boolean;
    readonly useFullSubmitUrl?: boolean;
  };
}): SingleModelEndpointRulesFormState {
  const defaults = createDefaultEndpointRulesFormState();
  if (!params.endpointRules || params.endpointRules.useOfficial !== false) {
    return {
      ...defaults,
      useFullSubmitUrl: params.endpointRules?.useFullSubmitUrl === true,
    };
  }

  return {
    useOfficial: false,
    useFullSubmitUrl: params.endpointRules.useFullSubmitUrl === true,
  };
}

export function SingleModelEndpointRulesFields({
  category,
  value,
  onChange,
  idPrefix,
  sharedFormatTransform = null,
  onSharedFormatTransformChange,
  formatTemplates = [],
  isFormatTemplatesLoading = false,
}: SingleModelEndpointRulesFieldsProps) {
  const { t } = useTranslation();
  const isVideo = category === "video";
  const [formatMappingOpen, setFormatMappingOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Switch
            id={`${idPrefix}-custom-endpoint-params`}
            checked={!value.useOfficial}
            onCheckedChange={(useCustomParams) => {
              onChange({
                ...value,
                useOfficial: !useCustomParams,
              });
            }}
          />
          <label
            htmlFor={`${idPrefix}-custom-endpoint-params`}
            className="min-w-0 flex-1 cursor-pointer text-sm leading-snug"
          >
            {t("pages.aiInterfaces.singleModel.customEndpointParams")}
          </label>
        </div>

        {!value.useOfficial && isVideo ? (
          <SingleModelFormatMappingPreview
            formatTransform={sharedFormatTransform}
            onOpenSettings={
              onSharedFormatTransformChange
                ? () => setFormatMappingOpen(true)
                : undefined
            }
          />
        ) : null}
      </div>

      {onSharedFormatTransformChange ? (
        <FormatMappingSettingsDialog
          open={formatMappingOpen}
          onOpenChange={setFormatMappingOpen}
          value={sharedFormatTransform}
          onChange={onSharedFormatTransformChange}
          formatTemplates={formatTemplates}
          isFormatTemplatesLoading={isFormatTemplatesLoading}
        />
      ) : null}
    </>
  );
}
