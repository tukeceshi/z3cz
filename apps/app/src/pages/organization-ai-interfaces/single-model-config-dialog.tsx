import type { OrganizationAiInterface } from "@dafthunk/types";
import {
  buildSingleModelSnapshotFromInterface,
  DEEPSEEK_PROVIDER_CARD_ID,
  formatPlatformModelLabel,
  GLM_PROVIDER_CARD_ID,
  GEMINI_PROVIDER_CARD_ID,
  CLAUDE_PROVIDER_CARD_ID,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  isSingleModelProviderMetadata,
  KIMI_PROVIDER_CARD_ID,
  NANO_BANANA_PROVIDER_CARD_ID,
  VEO_PROVIDER_CARD_ID,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_PROVIDER_CARD_ID,
} from "@dafthunk/types";
import { useEffect, useMemo, useState } from "react";

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
import { updateOrganizationAiInterface } from "@/services/organization-ai-interface-service";

import { DeepSeekModelIdEditList } from "./deepseek-model-config-row";
import { KimiEndpointRegionHints } from "./kimi-endpoint-region-hints";

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
  const [modelIdsByCanonicalId, setModelIdsByCanonicalId] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);

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
      iface.metadata.singleModelPresetId === SEEDREAM_PROVIDER_CARD_ID);

  const isKimiProvider =
    isSingleModelProviderMetadata(iface.metadata) &&
    iface.metadata.singleModelPresetId === KIMI_PROVIDER_CARD_ID;

  const snapshot = useMemo(
    () => (isMultiModelProvider ? buildSingleModelSnapshotFromInterface(iface) : null),
    [iface, isMultiModelProvider]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(iface.name);
    setBaseUrl(iface.baseUrl ?? "");
    setApiKey("");
    if (snapshot) {
      setModelIdsByCanonicalId(
        Object.fromEntries(
          snapshot.models.map((row) => [row.canonicalId, row.upstreamModelId])
        )
      );
    }
  }, [iface.baseUrl, iface.name, open, snapshot]);

  const handleModelIdChange = (canonicalId: string, value: string) => {
    setModelIdsByCanonicalId((current) => ({
      ...current,
      [canonicalId]: value,
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      appToast.error("pages.aiInterfaces.nameTemplateRequired");
      return;
    }
    if (!baseUrl.trim()) {
      appToast.error("pages.aiInterfaces.singleModel.endpointRequired");
      return;
    }
    if (isMultiModelProvider && snapshot) {
      for (const row of snapshot.models) {
        if (!modelIdsByCanonicalId[row.canonicalId]?.trim()) {
          appToast.error("pages.aiInterfaces.singleModel.modelIdRequired");
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await updateOrganizationAiInterface(organizationId, iface.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(isMultiModelProvider && snapshot
          ? {
              singleModelUpstreamModelIds: Object.fromEntries(
                snapshot.models.map((row) => [
                  row.canonicalId,
                  modelIdsByCanonicalId[row.canonicalId]?.trim() ?? "",
                ])
              ),
            }
          : {}),
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

  const modelIdRows =
    snapshot?.models.map((row) => {
      const modalityShort = t(
        `pages.aiInterfaces.volcano.modalityShort.${row.modality}`
      );
      return {
        canonicalId: row.canonicalId,
        label: formatPlatformModelLabel({
          alias: row.alias,
          modalityLabel: modalityShort,
        }),
        modelId: modelIdsByCanonicalId[row.canonicalId] ?? row.upstreamModelId,
      };
    }) ?? [];

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
          {isMultiModelProvider && modelIdRows.length > 0 ? (
            <div className="space-y-2">
              <Label>{t("pages.aiInterfaces.singleModel.modelId")}</Label>
              <DeepSeekModelIdEditList
                rows={modelIdRows}
                modelColumnLabel={t("pages.aiInterfaces.singleModel.modelColumn")}
                modelIdLabel={t("pages.aiInterfaces.singleModel.modelId")}
                onModelIdChange={handleModelIdChange}
              />
            </div>
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
