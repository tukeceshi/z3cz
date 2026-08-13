import type {
  OrganizationAiInterface,
  SingleModelCapabilityLimits,
  SingleModelFormatTransform,
  SingleModelInstanceDraft,
} from "@dafthunk/types";
import {
  buildSingleModelModelsMapFromInstances,
  DEEPSEEK_PROVIDER_CARD_ID,
  endpointRulesForMetadata,
  GLM_PROVIDER_CARD_ID,
  GEMINI_PROVIDER_CARD_ID,
  CLAUDE_PROVIDER_CARD_ID,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  isSingleModelProviderMetadata,
  KIMI_PROVIDER_CARD_ID,
  MINIMAX_SPEECH_PROVIDER_CARD_ID,
  NANO_BANANA_PROVIDER_CARD_ID,
  VEO_PROVIDER_CARD_ID,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  prepareSingleModelInstancesForSave,
  resolveSharedFormatTransformFromInstanceDrafts,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_PROVIDER_CARD_ID,
  singleModelInstancesFromMetadata,
  validateCustomSingleModelEndpointRules,
} from "@dafthunk/types";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CredentialPlainInput,
  CredentialSecretInput,
} from "@/components/credential-secret-input";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  updateOrganizationAiInterface,
  useOrganizationFormatTransformTemplates,
} from "@/services/organization-ai-interface-service";
import {
  usePlatformCatalogAudioModels,
  usePlatformCatalogImageModels,
  usePlatformCatalogTextModels,
  usePlatformCatalogVideoModels,
  usePlatformVideoModelBaselines,
} from "@/services/platform-ai-model-service";

import { CapabilityLimitsSettingsDialog } from "./capability-limits-settings-dialog";
import { KimiEndpointRegionHints } from "./kimi-endpoint-region-hints";
import {
  endpointRulesFormStateFromMetadata,
  SingleModelEndpointRulesFields,
  type SingleModelEndpointRulesFormState,
} from "./single-model-endpoint-rules-fields";
import {
  SingleModelInstanceList,
  type ProviderModelPoolOption,
} from "./single-model-instance-list";
import {
  listPresetAvailableModels,
  useApiPresetChannelIdMap,
} from "./use-preset-channel-model-ids";
import {
  SingleModelVideoEndpointUrlFields,
} from "./single-model-endpoint-url-preview";

interface SingleModelConfigDialogProps {
  readonly organizationId: string;
  readonly iface: OrganizationAiInterface;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => Promise<void>;
}

export function SingleModelConfigDialog({
  organizationId,
  iface,
  open,
  onOpenChange,
  onSaved,
}: SingleModelConfigDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [name, setName] = useState(iface.name);
  const [baseUrl, setBaseUrl] = useState(iface.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [modelInstances, setModelInstances] = useState<
    SingleModelInstanceDraft[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [endpointRulesForm, setEndpointRulesForm] =
    useState<SingleModelEndpointRulesFormState>(() =>
      endpointRulesFormStateFromMetadata({})
    );
  const [capabilityLimitsByInstanceId, setCapabilityLimitsByInstanceId] =
    useState<Record<string, SingleModelCapabilityLimits | null>>({});
  const [sharedFormatTransform, setSharedFormatTransform] =
    useState<SingleModelFormatTransform | null>(null);
  const [capabilitySettingsInstanceId, setCapabilitySettingsInstanceId] =
    useState<string | null>(null);
  const { formatTemplates, isFormatTemplatesLoading } =
    useOrganizationFormatTransformTemplates(organizationId);
  const { baselines: platformBaselines, isBaselinesLoading } =
    usePlatformVideoModelBaselines(organizationId);
  const { models: platformModels } = usePlatformCatalogTextModels(
    open ? organizationId : undefined
  );
  const { models: imagePlatformModels } = usePlatformCatalogImageModels(
    open ? organizationId : undefined
  );
  const { models: videoPlatformModels } = usePlatformCatalogVideoModels(
    open ? organizationId : undefined
  );
  const { models: audioPlatformModels } = usePlatformCatalogAudioModels(
    open ? organizationId : undefined
  );
  const { presetChannelIds: apiPresetChannelIds } = useApiPresetChannelIdMap(
    open ? organizationId : undefined
  );

  const endpointRulesCategory =
    isSingleModelProviderMetadata(iface.metadata)
      ? iface.metadata.singleModelCategory ?? "text"
      : "text";

  const isMultiModelProvider =
    isSingleModelProviderMetadata(iface.metadata) &&
    (iface.metadata.singleModelPresetId === DEEPSEEK_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === SEED_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === GLM_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === GEMINI_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === KIMI_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === OPENAI_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === OPENAI_IMAGE_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === NANO_BANANA_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === VEO_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === GROK_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === CLAUDE_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === SEEDANCE_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === SEEDREAM_PROVIDER_CARD_ID ||
      iface.metadata.singleModelPresetId === MINIMAX_SPEECH_PROVIDER_CARD_ID);

  const isKimiProvider =
    isSingleModelProviderMetadata(iface.metadata) &&
    iface.metadata.singleModelPresetId === KIMI_PROVIDER_CARD_ID;

  const presetId = isSingleModelProviderMetadata(iface.metadata)
    ? iface.metadata.singleModelPresetId
    : undefined;

  const catalogModels = useMemo(() => {
    switch (endpointRulesCategory) {
      case "video":
        return videoPlatformModels;
      case "image":
        return imagePlatformModels;
      case "audio":
        return audioPlatformModels;
      default:
        return platformModels;
    }
  }, [
    audioPlatformModels,
    endpointRulesCategory,
    imagePlatformModels,
    platformModels,
    videoPlatformModels,
  ]);

  const modelPoolOptions = useMemo((): readonly ProviderModelPoolOption[] => {
    if (!isMultiModelProvider || !presetId) {
      return [];
    }
    return listPresetAvailableModels(
      apiPresetChannelIds,
      presetId,
      catalogModels
    ).map((model) => ({
      canonicalId: model.canonicalId,
      displayName: model.displayName,
      modality: model.modality,
    }));
  }, [apiPresetChannelIds, catalogModels, isMultiModelProvider, presetId]);

  const dialogInitSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      dialogInitSessionRef.current = null;
      return;
    }
    const sessionKey = iface.id;
    if (dialogInitSessionRef.current === sessionKey) {
      return;
    }
    dialogInitSessionRef.current = sessionKey;

    setName(iface.name);
    setBaseUrl(iface.baseUrl ?? "");
    setApiKey("");
    if (isSingleModelProviderMetadata(iface.metadata)) {
      setEndpointRulesForm(
        endpointRulesFormStateFromMetadata({
          endpointRules: iface.metadata.endpointRules,
        })
      );
      const instances = singleModelInstancesFromMetadata(
        iface.metadata,
        (canonicalId) => {
          const catalogModel = catalogModels.find(
            (model) => model.canonicalId === canonicalId
          );
          return catalogModel?.displayName ?? canonicalId;
        }
      );
      setModelInstances(instances);
      setSharedFormatTransform(
        resolveSharedFormatTransformFromInstanceDrafts(instances)
      );
      setCapabilityLimitsByInstanceId(
        Object.fromEntries(
          instances.map((instance) => [
            instance.instanceId,
            instance.capabilityLimits ?? null,
          ])
        )
      );
      setCapabilitySettingsInstanceId(null);
    }
  }, [
    catalogModels,
    iface.baseUrl,
    iface.id,
    iface.metadata,
    iface.name,
    open,
  ]);

  const handleSave = async () => {
    if (!name.trim()) {
      appToast.error("pages.aiInterfaces.nameTemplateRequired");
      return;
    }
    if (!baseUrl.trim()) {
      appToast.error("pages.aiInterfaces.singleModel.endpointRequired");
      return;
    }
    if (isMultiModelProvider) {
      if (
        !modelInstances.some(
          (instance) => instance.enabled && instance.upstreamModelId.trim()
        )
      ) {
        appToast.error("pages.aiInterfaces.singleModel.modelIdRequired");
        return;
      }
    }

    if (
      endpointRulesCategory === "video" &&
      !endpointRulesForm.useOfficial &&
      isSingleModelProviderMetadata(iface.metadata)
    ) {
      if (!sharedFormatTransform) {
        appToast.error("pages.aiInterfaces.singleModel.formatTemplateRequired");
        return;
      }
    }

    const endpointRules = endpointRulesForMetadata({
      useOfficial: endpointRulesForm.useOfficial,
      useFullSubmitUrl: endpointRulesForm.useFullSubmitUrl,
    });
    const endpointRulesValidation = validateCustomSingleModelEndpointRules({
      category: endpointRulesCategory,
      rules: endpointRules ?? { useOfficial: true },
    });
    if (endpointRulesValidation) {
      appToast.errorRaw(endpointRulesValidation);
      return;
    }

    setIsSaving(true);
    try {
      const applyCustomVideoRules =
        endpointRulesCategory === "video" && !endpointRulesForm.useOfficial;
      const preparedInstances = prepareSingleModelInstancesForSave({
        instances: modelInstances,
        sharedFormatTransform,
        capabilityLimitsByInstanceId,
        applyCustomVideoRules,
      });

      await updateOrganizationAiInterface(organizationId, iface.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(isSingleModelProviderMetadata(iface.metadata)
          ? {
              singleModelModels: buildSingleModelModelsMapFromInstances(
                preparedInstances
              ),
            }
          : {}),
        singleModelEndpointRules: endpointRules ?? {},
      });
      appToast.success("pages.aiInterfaces.updated");
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const baselineById = useMemo(
    () =>
      new Map(
        platformBaselines.map((baseline) => [baseline.canonicalId, baseline])
      ),
    [platformBaselines]
  );

  const isVideoCategory = endpointRulesCategory === "video";

  const capabilitySettingsModelLabel =
    capabilitySettingsInstanceId !== null
      ? (modelInstances.find(
          (instance) => instance.instanceId === capabilitySettingsInstanceId
        )?.displayName ?? capabilitySettingsInstanceId)
      : "";

  const capabilitySettingsLabel = t(
    "pages.aiInterfaces.singleModel.capabilityLimitsSettingsTitle"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.singleModel.editConfigTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="single-model-config-endpoint">
              {t("pages.aiInterfaces.singleModel.endpointUrl")}
            </Label>
            <CredentialPlainInput
              id="single-model-config-endpoint"
              name="single_model_config_endpoint"
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
            {isKimiProvider ? <KimiEndpointRegionHints /> : null}
            {endpointRulesCategory === "video" ? (
              <SingleModelVideoEndpointUrlFields
                idPrefix="single-model-config"
                baseUrl={baseUrl}
                category={endpointRulesCategory}
                useFullSubmitUrl={endpointRulesForm.useFullSubmitUrl}
                onUseFullSubmitUrlChange={(useFullSubmitUrl) =>
                  setEndpointRulesForm((current) => ({
                    ...current,
                    useFullSubmitUrl,
                  }))
                }
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="single-model-config-api-key">
              {t("pages.aiInterfaces.apiKeyKeepHint")}
            </Label>
            <CredentialSecretInput
              id="single-model-config-api-key"
              name="single_model_config_api_key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="single-model-config-name">
              {t("pages.aiInterfaces.singleModel.brandName")}
            </Label>
            <CredentialPlainInput
              id="single-model-config-name"
              name="single_model_config_name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {isMultiModelProvider ? (
            <div className="space-y-2">
              <Label>{t("pages.aiInterfaces.singleModel.selectModels")}</Label>
              <SingleModelInstanceList
                availableModels={modelPoolOptions}
                instances={modelInstances}
                onChange={setModelInstances}
                modelColumnLabel={t("pages.aiInterfaces.singleModel.modelColumn")}
                modelIdLabel={t("pages.aiInterfaces.singleModel.modelId")}
                addModelLabel={t("pages.aiInterfaces.singleModel.addModel")}
                showCapabilitySettings={isVideoCategory}
                onOpenCapabilitySettings={setCapabilitySettingsInstanceId}
                capabilitySettingsLabel={capabilitySettingsLabel}
              />
            </div>
          ) : null}
          {endpointRulesCategory !== "storage" ? (
            <SingleModelEndpointRulesFields
              category={endpointRulesCategory}
              value={endpointRulesForm}
              onChange={setEndpointRulesForm}
              idPrefix="single-model-config"
              sharedFormatTransform={sharedFormatTransform}
              onSharedFormatTransformChange={setSharedFormatTransform}
              formatTemplates={formatTemplates}
              isFormatTemplatesLoading={
                isFormatTemplatesLoading || isBaselinesLoading
              }
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CapabilityLimitsSettingsDialog
        open={capabilitySettingsInstanceId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCapabilitySettingsInstanceId(null);
          }
        }}
        modelLabel={capabilitySettingsModelLabel}
        platformBaseline={
          capabilitySettingsInstanceId
            ? (baselineById.get(
                modelInstances.find(
                  (instance) =>
                    instance.instanceId === capabilitySettingsInstanceId
                )?.canonicalId ?? ""
              ) ?? null)
            : null
        }
        value={
          capabilitySettingsInstanceId
            ? (capabilityLimitsByInstanceId[capabilitySettingsInstanceId] ??
              null)
            : null
        }
        onChange={(limits) => {
          if (!capabilitySettingsInstanceId) {
            return;
          }
          setCapabilityLimitsByInstanceId((current) => ({
            ...current,
            [capabilitySettingsInstanceId]: limits,
          }));
        }}
      />
    </Dialog>
  );
}

function resolveApiKeyDisplay(
  iface: OrganizationAiInterface,
  configuredLabel: string
): string {
  if (iface.apiKeyHint?.trim()) {
    return iface.apiKeyHint.trim();
  }
  if (iface.hasApiKey) {
    return configuredLabel;
  }
  return "—";
}

interface SingleModelConnectionSummaryProps {
  readonly iface: OrganizationAiInterface;
  readonly onEdit: () => void;
}

export function SingleModelConnectionSummary({
  iface,
  onEdit,
}: SingleModelConnectionSummaryProps) {
  const { t } = useTranslation();
  const apiKeyDisplay = resolveApiKeyDisplay(
    iface,
    t("pages.aiInterfaces.singleModel.apiKeyConfigured")
  );

  return (
    <div className="bg-muted/30 space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <p className="text-muted-foreground">
            {t("pages.aiInterfaces.singleModel.endpointUrl")}：
            <span className="text-foreground break-all font-mono text-xs">
              {iface.baseUrl?.trim() || "—"}
            </span>
          </p>
          <p className="text-muted-foreground">
            {t("pages.aiInterfaces.apiKey")}：
            <span className="text-foreground font-mono text-xs">
              {apiKeyDisplay}
            </span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t("pages.aiInterfaces.singleModel.editConfig")}
        </Button>
      </div>
    </div>
  );
}
