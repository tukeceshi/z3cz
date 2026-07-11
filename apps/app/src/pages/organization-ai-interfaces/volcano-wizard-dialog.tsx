import {
  VOLCANO_AI_MODEL_CATALOG,
  VOLCANO_PRODUCT_DISPLAY_NAME_ZH,
  VOLCANO_TEMPLATE_ID,
  type VolcanoActivationProbeResult,
} from "@dafthunk/types";
import ExternalLink from "lucide-react/icons/external-link";
import Search from "lucide-react/icons/search";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  createOrganizationAiInterface,
  probeVolcanoCredentials,
} from "@/services/organization-ai-interface-service";

import { VolcanoModelRow } from "./volcano-model-row";

const IAM_KEY_URL = "https://console.volcengine.com/iam/keymanage";
const OPEN_MANAGEMENT_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/openManagement";
const GET_API_KEY_DOC_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/docs/82379/1262825?lang=zh";

interface VolcanoWizardDialogProps {
  open: boolean;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

function activationByCanonicalId(
  results: readonly VolcanoActivationProbeResult[]
): Record<string, VolcanoActivationProbeResult> {
  return Object.fromEntries(results.map((result) => [result.canonicalId, result]));
}

export function VolcanoWizardDialog({
  open,
  organizationId,
  onOpenChange,
  onCreated,
}: VolcanoWizardDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [step, setStep] = useState(1);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [name, setName] = useState(VOLCANO_PRODUCT_DISPLAY_NAME_ZH);
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        VOLCANO_AI_MODEL_CATALOG.map((entry) => [entry.canonicalId, true])
      )
  );
  const [activationResults, setActivationResults] = useState<
    Record<string, VolcanoActivationProbeResult>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isProbing, setIsProbing] = useState(false);

  const selectedModelIds = useMemo(
    () =>
      Object.entries(enabledModels)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id),
    [enabledModels]
  );

  const reset = () => {
    setStep(1);
    setAccessKeyId("");
    setSecretAccessKey("");
    setName(VOLCANO_PRODUCT_DISPLAY_NAME_ZH);
    setEnabledModels(
      Object.fromEntries(
        VOLCANO_AI_MODEL_CATALOG.map((entry) => [entry.canonicalId, true])
      )
    );
    setActivationResults({});
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const runActivationProbe = async (canonicalIds: string[]) => {
    setIsProbing(true);
    try {
      const { results } = await probeVolcanoCredentials(organizationId, {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
        canonicalIds,
      });
      setActivationResults((current) => ({
        ...current,
        ...activationByCanonicalId(results),
      }));
      return results;
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.volcano.activation.probeFailed")
      );
      return null;
    } finally {
      setIsProbing(false);
    }
  };

  const handleNextFromStep2 = async () => {
    const ids = selectedModelIds;
    if (ids.length > 0) {
      await runActivationProbe(ids);
    }
    setStep(3);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      appToast.error("pages.aiInterfaces.nameTemplateRequired");
      return;
    }
    if (!accessKeyId.trim() || !secretAccessKey.trim()) {
      appToast.error("pages.aiInterfaces.volcano.credentialsRequired");
      return;
    }

    setIsSaving(true);
    try {
      await createOrganizationAiInterface(organizationId, {
        templateId: VOLCANO_TEMPLATE_ID,
        name: name.trim(),
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
        enabledModels: selectedModelIds,
        enabled: true,
        isDefault: true,
      });
      appToast.success("pages.aiInterfaces.created");
      handleClose(false);
      await onCreated();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.volcano.wizardTitle", { step })}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.step1Description")}
            </p>
            <Button variant="outline" asChild>
              <a href={IAM_KEY_URL} target="_blank" rel="noreferrer">
                {t("pages.aiInterfaces.volcano.openIamConsole")}
                <ExternalLink className="ml-2 size-4" />
              </a>
            </Button>
            <p className="text-muted-foreground text-xs">
              <a
                href={GET_API_KEY_DOC_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {t("pages.aiInterfaces.volcano.getApiKeyDoc")}
              </a>
            </p>
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="hidden"
              tabIndex={-1}
              aria-hidden
              readOnly
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="hidden"
              tabIndex={-1}
              aria-hidden
              readOnly
            />
            <div className="space-y-2">
              <Label htmlFor="volcano-ak">{t("pages.aiInterfaces.volcano.accessKeyId")}</Label>
              <Input
                id="volcano-ak"
                name="volcano-access-key-id"
                autoComplete="off"
                value={accessKeyId}
                onChange={(event) => setAccessKeyId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volcano-sk">
                {t("pages.aiInterfaces.volcano.secretAccessKey")}
              </Label>
              <Input
                id="volcano-sk"
                name="volcano-secret-access-key"
                type="password"
                autoComplete="new-password"
                value={secretAccessKey}
                onChange={(event) => setSecretAccessKey(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.step2Description")}
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={OPEN_MANAGEMENT_URL} target="_blank" rel="noreferrer">
                {t("pages.aiInterfaces.volcano.openManagement")}
                <ExternalLink className="ml-2 size-4" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isProbing || selectedModelIds.length === 0}
              onClick={() => void runActivationProbe(selectedModelIds)}
            >
              <Search className={`mr-2 size-4 ${isProbing ? "animate-pulse" : ""}`} />
              {t("pages.aiInterfaces.volcano.activation.probeButton")}
            </Button>
            <div className="columns-1 gap-3 md:columns-2">
              {VOLCANO_AI_MODEL_CATALOG.map((entry) => {
                const probe = activationResults[entry.canonicalId];
                return (
                  <div key={entry.canonicalId} className="mb-3 break-inside-avoid">
                    <VolcanoModelRow
                      row={{
                        canonicalId: entry.canonicalId,
                        alias: entry.alias,
                        modality: entry.modality,
                        providerModelId: entry.providerModelId,
                        enabled: enabledModels[entry.canonicalId] ?? false,
                        usage: null,
                        activation: probe
                          ? {
                              status: probe.status,
                              probedAt: probe.probedAt,
                              errorCode: probe.errorCode,
                              message: probe.message,
                            }
                          : null,
                      }}
                      showUsage={false}
                      onEnabledChange={(enabled) =>
                        setEnabledModels((current) => ({
                          ...current,
                          [entry.canonicalId]: enabled,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.step3Description")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="volcano-name">{t("common.name")}</Label>
              <Input
                id="volcano-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p>
                {t("pages.aiInterfaces.volcano.selectedModels", {
                  count: selectedModelIds.length,
                })}
              </p>
              <p className="text-muted-foreground mt-1">
                {t("pages.aiInterfaces.volcano.autoKeyHint")}
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
                {t("common.back")}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              {t("common.cancel")}
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => {
                  if (step === 2) {
                    void handleNextFromStep2();
                    return;
                  }
                  setStep((current) => current + 1);
                }}
                disabled={
                  (step === 1 && (!accessKeyId.trim() || !secretAccessKey.trim())) ||
                  (step === 2 && isProbing)
                }
              >
                {t("common.next")}
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
