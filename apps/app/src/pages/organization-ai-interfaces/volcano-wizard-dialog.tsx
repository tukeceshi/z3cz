import {
  VOLCANO_AI_MODEL_CATALOG,
  VOLCANO_PRODUCT_DISPLAY_NAME_ZH,
  type VolcanoActivationProbeResult,
} from "@dafthunk/types";
import ExternalLink from "lucide-react/icons/external-link";
import Loader2 from "lucide-react/icons/loader-2";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  createOrganizationAiInterface,
  probeVolcanoCredentials,
  updateVolcanoTosStorage,
} from "@/services/organization-ai-interface-service";

import { VolcanoCredentialFields } from "./volcano-credential-fields";
import { VolcanoModelRow } from "./volcano-model-row";
import { VolcanoStorageSetupDialog } from "./volcano-storage-setup-dialog";

const IAM_KEY_URL = "https://console.volcengine.com/iam/keymanage";
const GET_API_KEY_DOC_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/docs/82379/1262825?lang=zh";

type WizardProbePhase = "idle" | "loading" | "ready" | "error";

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

function emptyEnabledModels(): Record<string, boolean> {
  return Object.fromEntries(
    VOLCANO_AI_MODEL_CATALOG.map((entry) => [entry.canonicalId, false])
  );
}

function enabledModelsFromProbeResults(
  results: readonly VolcanoActivationProbeResult[]
): Record<string, boolean> {
  return Object.fromEntries(
    VOLCANO_AI_MODEL_CATALOG.map((entry) => {
      const probe = results.find((result) => result.canonicalId === entry.canonicalId);
      return [entry.canonicalId, probe?.status === "open"];
    })
  );
}

function canToggleModelInWizard(
  probe: VolcanoActivationProbeResult | undefined
): boolean {
  return probe?.status === "open";
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
  const [name, setName] = useState<string>(VOLCANO_PRODUCT_DISPLAY_NAME_ZH);
  const [enabledModels, setEnabledModels] = useState(emptyEnabledModels);
  const [activationResults, setActivationResults] = useState<
    Record<string, VolcanoActivationProbeResult>
  >({});
  const [probePhase, setProbePhase] = useState<WizardProbePhase>("idle");
  const [probeError, setProbeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTos, setIsSavingTos] = useState(false);
  const [createdInterfaceId, setCreatedInterfaceId] = useState<string | null>(null);
  const [probeRunId, setProbeRunId] = useState(0);

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
    setEnabledModels(emptyEnabledModels());
    setActivationResults({});
    setProbePhase("idle");
    setProbeError(null);
    setProbeRunId(0);
    setCreatedInterfaceId(null);
    setIsSavingTos(false);
  };

  const finishWizard = async () => {
    handleClose(false);
    await onCreated();
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const runStep2Probe = useCallback(async () => {
    if (!accessKeyId.trim() || !secretAccessKey.trim()) {
      return;
    }

    setProbePhase("loading");
    setProbeError(null);
    setActivationResults({});
    setEnabledModels(emptyEnabledModels());

    try {
      const { results } = await probeVolcanoCredentials(organizationId, {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      });

      if (results.some((result) => result.status === "auth_error")) {
        setProbeError(t("pages.aiInterfaces.volcano.activation.authGlobalError"));
        setProbePhase("error");
        return;
      }

      setActivationResults(activationByCanonicalId(results));
      setEnabledModels(enabledModelsFromProbeResults(results));
      setProbePhase("ready");
    } catch (error) {
      setProbeError(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.volcano.activation.probeFailed")
      );
      setProbePhase("error");
    }
  }, [accessKeyId, organizationId, secretAccessKey, t]);

  useEffect(() => {
    if (step !== 2) {
      return;
    }
    void runStep2Probe();
  }, [step, probeRunId, runStep2Probe]);

  const handleRetryProbe = () => {
    setProbeRunId((current) => current + 1);
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
      const created = await createOrganizationAiInterface(organizationId, {
        provider: "doubao_volcano",
        name: name.trim(),
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
        enabledModels: selectedModelIds,
        volcanoActivationResults: Object.values(activationResults),
        enabled: true,
        isDefault: true,
      });
      appToast.success("pages.aiInterfaces.created");
      setCreatedInterfaceId(created.id);
      setStep(4);
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTosSetupComplete = async (params: {
    readonly region: string;
    readonly bucket: string;
    readonly createBucket: boolean;
    readonly enable: boolean;
  }) => {
    if (!createdInterfaceId) return;

    setIsSavingTos(true);
    try {
      await updateVolcanoTosStorage(organizationId, createdInterfaceId, {
        enabled: params.enable,
        region: params.region,
        bucket: params.bucket,
        createBucket: params.createBucket,
      });
      appToast.success("pages.aiInterfaces.tosStorage.saved");
      await finishWizard();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")
      );
    } finally {
      setIsSavingTos(false);
    }
  };

  if (step === 4 && createdInterfaceId) {
    return (
      <VolcanoStorageSetupDialog
        open={open}
        organizationId={organizationId}
        interfaceId={createdInterfaceId}
        initialRegion=""
        initialBucket=""
        defaultEnable
        isSaving={isSavingTos}
        showSkip
        onSkip={() => void finishWizard()}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            void finishWizard();
          }
        }}
        onComplete={handleTosSetupComplete}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.volcano.wizardTitle", { step })}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <form
            className="space-y-4"
            autoComplete="off"
            onSubmit={(event) => event.preventDefault()}
          >
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
            <VolcanoCredentialFields
              idPrefix="volcano-wizard"
              accessKeyId={accessKeyId}
              secretAccessKey={secretAccessKey}
              onAccessKeyIdChange={setAccessKeyId}
              onSecretAccessKeyChange={setSecretAccessKey}
            />
          </form>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.step2Description")}
            </p>

            {probePhase === "error" && probeError ? (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-destructive text-sm">{probeError}</p>
                <Button variant="outline" size="sm" onClick={handleRetryProbe}>
                  {t("pages.aiInterfaces.volcano.activation.probeRetry")}
                </Button>
              </div>
            ) : null}

            {probePhase === "loading" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  {t("pages.aiInterfaces.volcano.activation.probing")}
                </div>
                <div className="columns-1 gap-3 md:columns-2">
                  {VOLCANO_AI_MODEL_CATALOG.map((entry) => (
                    <Skeleton
                      key={entry.canonicalId}
                      className="mb-3 h-28 w-full rounded-lg break-inside-avoid"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {probePhase === "ready" ? (
              <div className="columns-1 gap-3 md:columns-2">
                {VOLCANO_AI_MODEL_CATALOG.map((entry) => {
                  const probe = activationResults[entry.canonicalId];
                  const canToggle = canToggleModelInWizard(probe);
                  return (
                    <div key={entry.canonicalId} className="mb-3 break-inside-avoid">
                      <VolcanoModelRow
                        hintVariant="wizard"
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
                        disabled={!canToggle}
                        onEnabledChange={
                          canToggle
                            ? (enabled) =>
                                setEnabledModels((current) => ({
                                  ...current,
                                  [entry.canonicalId]: enabled,
                                }))
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
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
                    setStep(3);
                    return;
                  }
                  setStep((current) => current + 1);
                }}
                disabled={
                  (step === 1 && (!accessKeyId.trim() || !secretAccessKey.trim())) ||
                  (step === 2 && probePhase !== "ready")
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
