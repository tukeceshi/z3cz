import {

  VOLCANO_AGGREGATE_MODEL_CATALOG,

  VOLCANO_PRODUCT_DISPLAY_NAME_ZH,

  type VolcanoActivationProbeResult,

  type VolcanoTosServiceStatus,

} from "@dafthunk/types";

import Loader2 from "lucide-react/icons/loader-2";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";



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

import type { TranslationKey } from "@/i18n";

import { useAppToast } from "@/hooks/use-app-toast";

import { authService } from "@/services/auth-service";

import {

  createOrganizationAiInterface,

  probeVolcanoCredentials,

  probeVolcanoTosBuckets,

  updateVolcanoTosStorage,

  AI_INTERFACE_NAME_CONFLICT_CODE,
  VOLCANO_ARK_NOT_OPENED_CODE,
  VOLCANO_TOS_NOT_OPENED_CODE,
} from "@/services/organization-ai-interface-service";

import { ApiRequestError } from "@/services/utils";



import { VolcanoArkNotOpenedGuide } from "./volcano-ark-not-opened-guide";

import { VolcanoCredentialFields } from "./volcano-credential-fields";

import { VolcanoStep1Guide } from "./volcano-step1-guide";

import {
  isVolcanoWizardTosGatePhase,
  resolveVolcanoWizardTosGateMode,
  VolcanoWizardTosGate,
} from "./volcano-wizard-tos-gate";

import { VolcanoWizardSetupBanners } from "./volcano-setup-banners";

import { VolcanoModelRow } from "./volcano-model-row";

import {

  createDefaultWizardTosConfig,

  VolcanoWizardStorageCard,

  type WizardTosConfig,

} from "./volcano-wizard-storage-card";

import { resolveNewTosBucketName } from "./volcano-storage-bucket-name";



type WizardProbePhase =

  | "idle"

  | "loading"

  | "probing_tos"

  | "tos_not_opened"

  | "tos_auth_error"

  | "ready"

  | "ark_not_opened"

  | "error";



function waitForNextFrame(): Promise<void> {

  return new Promise((resolve) => {

    requestAnimationFrame(() => resolve());

  });

}



function WizardStep2CardSkeletons() {

  return (

    <div className="columns-1 gap-3 md:columns-2">

      <Skeleton className="mb-3 h-24 w-full rounded-lg break-inside-avoid" />

      {VOLCANO_AGGREGATE_MODEL_CATALOG.map((entry) => (

        <Skeleton

          key={entry.canonicalId}

          className="mb-3 h-28 w-full rounded-lg break-inside-avoid"

        />

      ))}

    </div>

  );

}



interface VolcanoWizardFlowProps {

  open: boolean;

  organizationId: string;

  onOpenChange: (open: boolean) => void;

  onBackToChannel: () => void;

  onCreated: () => Promise<void>;

}



function stepTitleKey(step: number): TranslationKey {

  if (step === 1) return "pages.aiInterfaces.addWizard.volcanoStep1Title";

  if (step === 2) return "pages.aiInterfaces.addWizard.volcanoStep2Title";

  return "pages.aiInterfaces.addWizard.volcanoStep3Title";

}



function activationByCanonicalId(

  results: readonly VolcanoActivationProbeResult[]

): Record<string, VolcanoActivationProbeResult> {

  return Object.fromEntries(results.map((result) => [result.canonicalId, result]));

}



function emptyEnabledModels(): Record<string, boolean> {

  return Object.fromEntries(

    VOLCANO_AGGREGATE_MODEL_CATALOG.map((entry) => [entry.canonicalId, false])

  );

}



function enabledModelsFromProbeResults(

  results: readonly VolcanoActivationProbeResult[]

): Record<string, boolean> {

  return Object.fromEntries(

    VOLCANO_AGGREGATE_MODEL_CATALOG.map((entry) => {

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



function normalizeWizardProbeResult(

  result: VolcanoActivationProbeResult

): VolcanoActivationProbeResult {

  if (result.status === "open" || result.status === "auth_error") {

    return result;

  }

  return { ...result, status: "not_open" };

}



function normalizeWizardProbeResults(

  results: readonly VolcanoActivationProbeResult[]

): VolcanoActivationProbeResult[] {

  return results.map(normalizeWizardProbeResult);

}



export function VolcanoWizardFlow({

  open,

  organizationId,

  onOpenChange,

  onBackToChannel,

  onCreated,

}: VolcanoWizardFlowProps) {

  const { t, locale } = useTranslation();

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

  const [tosConfig, setTosConfig] = useState<WizardTosConfig>(() =>

    createDefaultWizardTosConfig(locale, organizationId)

  );

  const [tosServiceStatus, setTosServiceStatus] =
    useState<VolcanoTosServiceStatus | null>(null);

  const [isRetryingTos, setIsRetryingTos] = useState(false);

  const [probeRunId, setProbeRunId] = useState(0);

  const shouldRunProbeRef = useRef(false);

  const probeInFlightRef = useRef(false);



  const selectedModelIds = useMemo(

    () =>

      Object.entries(enabledModels)

        .filter(([, enabled]) => enabled)

        .map(([id]) => id),

    [enabledModels]

  );



  const notOpenModelCount = useMemo(
    () =>
      Object.values(activationResults).filter(
        (result) => result.status === "not_open"
      ).length,
    [activationResults]
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

    shouldRunProbeRef.current = false;

    probeInFlightRef.current = false;

    setTosConfig(createDefaultWizardTosConfig(locale, organizationId));

    setTosServiceStatus(null);

    setIsRetryingTos(false);

  };



  const handleClose = (nextOpen: boolean) => {

    if (!nextOpen) reset();

    onOpenChange(nextOpen);

  };



  const finishWizard = async () => {

    handleClose(false);

    await onCreated();

  };



  const scheduleStep2Probe = useCallback(() => {

    shouldRunProbeRef.current = true;

    setProbeRunId((current) => current + 1);

  }, []);



  const applyTosProbeResult = useCallback(

    (status: VolcanoTosServiceStatus) => {

      if (status === "not_opened") {

        setTosConfig((current) => ({ ...current, enabled: false }));

        setProbePhase("tos_not_opened");

        return;

      }

      if (status === "auth_error") {

        setTosConfig((current) => ({ ...current, enabled: false }));

        setProbePhase("tos_auth_error");

        return;

      }

      if (status === "transient_error") {

        setProbeError(t("pages.aiInterfaces.tosStorage.loadFailed"));

        setProbePhase("error");

        return;

      }

      setTosConfig((current) => ({ ...current, enabled: true }));

      setProbePhase("ready");

    },

    [t]

  );



  const runTosProbe = useCallback(async (): Promise<VolcanoTosServiceStatus> => {

    setProbePhase("probing_tos");

    setTosServiceStatus(null);

    await waitForNextFrame();

    try {

      const tosResult = await probeVolcanoTosBuckets(organizationId, {

        accessKeyId: accessKeyId.trim(),

        secretAccessKey: secretAccessKey.trim(),

        region: tosConfig.region,

      });

      setTosServiceStatus(tosResult.status);

      if (tosResult.status === "opened") {

        setTosConfig((current) => {

          if (!current.createBucket) {

            return current;

          }

          return {

            ...current,

            resolvedBucketName: resolveNewTosBucketName(

              tosResult.buckets,

              organizationId

            ),

          };

        });

      }

      return tosResult.status;

    } catch (error) {

      if (

        error instanceof ApiRequestError &&

        error.code === VOLCANO_TOS_NOT_OPENED_CODE

      ) {

        setTosServiceStatus("not_opened");

        return "not_opened";

      }

      setTosServiceStatus("transient_error");

      return "transient_error";

    }

  }, [accessKeyId, organizationId, secretAccessKey, tosConfig.region]);



  const runStep2Probe = useCallback(async () => {

    if (!accessKeyId.trim() || !secretAccessKey.trim()) {

      return;

    }

    if (probeInFlightRef.current) {

      return;

    }



    probeInFlightRef.current = true;

    setProbePhase("loading");

    setProbeError(null);

    setActivationResults({});

    setEnabledModels(emptyEnabledModels());



    try {

      await authService.refreshToken();



      const { results } = await probeVolcanoCredentials(organizationId, {

        accessKeyId: accessKeyId.trim(),

        secretAccessKey: secretAccessKey.trim(),

      });

      const normalizedResults = normalizeWizardProbeResults(results);



      if (normalizedResults.some((result) => result.status === "auth_error")) {

        setProbeError(t("pages.aiInterfaces.volcano.activation.authGlobalError"));

        setProbePhase("error");

        return;

      }



      setActivationResults(activationByCanonicalId(normalizedResults));

      setEnabledModels(enabledModelsFromProbeResults(normalizedResults));

      await waitForNextFrame();

      const tosStatus = await runTosProbe();

      await waitForNextFrame();

      applyTosProbeResult(tosStatus);

    } catch (error) {

      if (

        error instanceof ApiRequestError &&

        error.code === VOLCANO_ARK_NOT_OPENED_CODE

      ) {

        setProbePhase("ark_not_opened");

        return;

      }

      if (error instanceof ApiRequestError && error.status === 401) {

        setProbeError(t("pages.aiInterfaces.volcano.activation.sessionExpired"));

        setProbePhase("error");

        return;

      }

      setProbeError(

        error instanceof Error

          ? error.message

          : t("pages.aiInterfaces.volcano.activation.probeFailed")

      );

      setProbePhase("error");

    } finally {

      probeInFlightRef.current = false;

    }

  }, [accessKeyId, applyTosProbeResult, organizationId, runTosProbe, secretAccessKey, t]);



  const handleRetryTosProbe = useCallback(async () => {

    if (probeInFlightRef.current) {

      return;

    }

    probeInFlightRef.current = true;

    setIsRetryingTos(true);

    setProbeError(null);

    try {

      const status = await runTosProbe();

      await waitForNextFrame();

      applyTosProbeResult(status);

    } finally {

      probeInFlightRef.current = false;

      setIsRetryingTos(false);

    }

  }, [applyTosProbeResult, runTosProbe]);



  const handleSkipTosAndContinue = useCallback(() => {

    setTosConfig((current) => ({ ...current, enabled: false }));

    setProbePhase("ready");

  }, []);



  useEffect(() => {

    if (step !== 2 || !shouldRunProbeRef.current) {

      return;

    }

    shouldRunProbeRef.current = false;

    void runStep2Probe();

  }, [step, probeRunId, runStep2Probe]);



  const handleRetryProbe = () => {

    scheduleStep2Probe();

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



      if (tosConfig.enabled) {

        if (tosServiceStatus === "not_opened") {

          appToast.success("pages.aiInterfaces.tosStorage.notOpened.saveSkipped");

        } else {

          try {

            await updateVolcanoTosStorage(organizationId, created.id, {

              enabled: true,

              region: tosConfig.region,

              bucket: tosConfig.resolvedBucketName,

              createBucket: tosConfig.createBucket,

            });

            appToast.success("pages.aiInterfaces.tosStorage.saved");

          } catch (tosError) {

            if (

              tosError instanceof ApiRequestError &&

              tosError.code === VOLCANO_TOS_NOT_OPENED_CODE

            ) {

              appToast.success("pages.aiInterfaces.tosStorage.notOpened.saveSkipped");

            } else {

              appToast.errorRaw(

                tosError instanceof Error

                  ? tosError.message

                  : t("pages.aiInterfaces.tosStorage.saveFailed")

              );

            }

            appToast.success("pages.aiInterfaces.volcano.createdStorageFailed");

          }

        }

      } else {

        appToast.success("pages.aiInterfaces.created");

      }



      await finishWizard();

    } catch (error) {

      if (

        error instanceof ApiRequestError &&

        error.code === AI_INTERFACE_NAME_CONFLICT_CODE

      ) {

        appToast.error("pages.aiInterfaces.duplicateName");

        return;

      }

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

            {t(stepTitleKey(step))}

            <span className="text-muted-foreground ml-2 text-sm font-normal">

              {t("pages.aiInterfaces.addWizard.progress", {

                step: step + 1,

                total: 4,

              })}

            </span>

          </DialogTitle>

        </DialogHeader>



        {step === 1 ? (

          <div className="space-y-4">

            <VolcanoStep1Guide />

            <VolcanoCredentialFields

              idPrefix="volcano-wizard"

              accessKeyId={accessKeyId}

              secretAccessKey={secretAccessKey}

              onAccessKeyIdChange={setAccessKeyId}

              onSecretAccessKeyChange={setSecretAccessKey}

            />

          </div>

        ) : null}



        {step === 2 ? (

          <div className="space-y-3">

            <p className="text-muted-foreground text-sm">

              {t("pages.aiInterfaces.volcano.step2Description")}

            </p>



            {probePhase === "ark_not_opened" ? (

              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">

                <VolcanoArkNotOpenedGuide />

                <Button variant="outline" size="sm" onClick={handleRetryProbe}>

                  {t("pages.aiInterfaces.volcano.activation.probeRetry")}

                </Button>

              </div>

            ) : null}



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

                <WizardStep2CardSkeletons />

              </div>

            ) : null}



            {isVolcanoWizardTosGatePhase(probePhase) ? (

              <div className="space-y-3">

                {resolveVolcanoWizardTosGateMode(probePhase, tosServiceStatus) ? (

                  <VolcanoWizardTosGate

                    mode={

                      resolveVolcanoWizardTosGateMode(probePhase, tosServiceStatus)!

                    }

                    isRetrying={isRetryingTos}

                    onRetry={() => void handleRetryTosProbe()}

                    onSkip={handleSkipTosAndContinue}

                  />

                ) : null}

                {probePhase === "probing_tos" && tosServiceStatus === null ? (

                  <WizardStep2CardSkeletons />

                ) : null}

              </div>

            ) : null}



            {probePhase === "ready" ? (

              <div className="space-y-3">

                <VolcanoWizardSetupBanners
                  notOpenModelCount={notOpenModelCount}
                />

                <div className="columns-1 gap-3 md:columns-2">

                  <div className="mb-3 break-inside-avoid">

                    <VolcanoWizardStorageCard

                      organizationId={organizationId}

                      accessKeyId={accessKeyId.trim()}

                      secretAccessKey={secretAccessKey.trim()}

                      config={tosConfig}

                      serviceStatus={tosServiceStatus}

                      onConfigChange={setTosConfig}

                      onServiceStatusChange={setTosServiceStatus}

                    />

                  </div>

                  {VOLCANO_AGGREGATE_MODEL_CATALOG.map((entry) => {

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

              {tosConfig.enabled ? (

                <p className="text-muted-foreground mt-1">

                  {t("pages.aiInterfaces.tosStorage.wizardSaveHint")}

                </p>

              ) : null}

            </div>

          </div>

        ) : null}



        <DialogFooter className="gap-2 sm:justify-between">

          <div>

            {step > 1 ? (

              <Button variant="outline" onClick={() => setStep((current) => current - 1)}>

                {t("common.back")}

              </Button>

            ) : (

              <Button variant="outline" onClick={onBackToChannel}>

                {t("common.back")}

              </Button>

            )}

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

                  if (step === 1) {

                    scheduleStep2Probe();

                    setStep(2);

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


