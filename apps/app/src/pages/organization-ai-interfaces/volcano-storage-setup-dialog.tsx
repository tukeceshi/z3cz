import {
  VOLCANO_TOS_DEFAULT_PREFIX,
  VOLCANO_TOS_REGIONS,
  defaultVolcanoTosRegionForLocale,
  type VolcanoTosServiceStatus,
} from "@dafthunk/types";
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
import {
  listVolcanoTosBuckets,
  probeVolcanoTosBuckets,
} from "@/services/organization-ai-interface-service";
import { cn } from "@/utils/utils";

import { resolveNewTosBucketName } from "./volcano-storage-bucket-name";
import { CREATE_NEW_TOS_BUCKET } from "./volcano-storage-constants";
import {
  VolcanoTosAuthErrorGuide,
  VolcanoTosNotOpenedGuide,
} from "./volcano-tos-not-opened-guide";
import { VolcanoTosPricingLines } from "./volcano-tos-pricing-lines";

interface VolcanoStorageSetupDialogProps {
  readonly open: boolean;
  readonly organizationId: string;
  readonly interfaceId?: string;
  readonly wizardCredentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
  readonly initialRegion: string;
  readonly initialBucket: string;
  readonly defaultEnable: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onComplete: (params: {
    readonly region: string;
    readonly bucket: string;
    readonly createBucket: boolean;
    readonly enable: boolean;
  }) => Promise<void>;
  readonly onServiceStatusChange?: (status: VolcanoTosServiceStatus) => void;
  readonly isSaving: boolean;
}

export function VolcanoStorageSetupDialog({
  open,
  organizationId,
  interfaceId,
  wizardCredentials,
  initialRegion,
  initialBucket,
  defaultEnable,
  onOpenChange,
  onComplete,
  onServiceStatusChange,
  isSaving,
}: VolcanoStorageSetupDialogProps) {
  const { t, locale } = useTranslation();
  const [region, setRegion] = useState(
    initialRegion || defaultVolcanoTosRegionForLocale(locale)
  );
  const [buckets, setBuckets] = useState<readonly string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState(
    initialBucket || CREATE_NEW_TOS_BUCKET
  );
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
  const [bucketLoadError, setBucketLoadError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] =
    useState<VolcanoTosServiceStatus | null>(null);
  const [confirmExistingOpen, setConfirmExistingOpen] = useState(false);

  const isCreateNewSelected = selectedBucket === CREATE_NEW_TOS_BUCKET;

  const bucketOptions = useMemo(
    () => [...buckets, CREATE_NEW_TOS_BUCKET] as const,
    [buckets]
  );

  const loadBuckets = useCallback(
    async (targetRegion: string, preferredBucket?: string) => {
      setIsLoadingBuckets(true);
      setBucketLoadError(null);
      try {
        const result = wizardCredentials
          ? await probeVolcanoTosBuckets(organizationId, {
              accessKeyId: wizardCredentials.accessKeyId,
              secretAccessKey: wizardCredentials.secretAccessKey,
              region: targetRegion,
            })
          : interfaceId
            ? await listVolcanoTosBuckets(
                organizationId,
                interfaceId,
                targetRegion
              )
            : null;

        if (!result) {
          throw new Error("Storage setup requires interface or wizard credentials");
        }

        setServiceStatus(result.status);
        onServiceStatusChange?.(result.status);

        if (result.status === "not_opened") {
          setBuckets([]);
          setSelectedBucket(CREATE_NEW_TOS_BUCKET);
          return;
        }

        if (result.status === "auth_error") {
          setBuckets([]);
          setSelectedBucket(CREATE_NEW_TOS_BUCKET);
          setBucketLoadError(null);
          return;
        }

        if (result.status !== "opened") {
          setBuckets([]);
          setSelectedBucket(CREATE_NEW_TOS_BUCKET);
          setBucketLoadError(
            result.message ?? t("pages.aiInterfaces.tosStorage.loadFailed")
          );
          return;
        }

        const listed = result.buckets;
        setBuckets(listed);
        const bucketPreference = preferredBucket ?? initialBucket;
        if (bucketPreference === CREATE_NEW_TOS_BUCKET) {
          setSelectedBucket(CREATE_NEW_TOS_BUCKET);
        } else if (bucketPreference && listed.includes(bucketPreference)) {
          setSelectedBucket(bucketPreference);
        } else if (listed.length > 0) {
          setSelectedBucket(listed[0]!);
        } else {
          setSelectedBucket(CREATE_NEW_TOS_BUCKET);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("pages.aiInterfaces.tosStorage.loadFailed");
        setBucketLoadError(message);
        setBuckets([]);
        setSelectedBucket(CREATE_NEW_TOS_BUCKET);
        setServiceStatus("transient_error");
      } finally {
        setIsLoadingBuckets(false);
      }
    },
    [
      initialBucket,
      interfaceId,
      onServiceStatusChange,
      organizationId,
      t,
      wizardCredentials,
    ]
  );

  useEffect(() => {
    if (!open) return;
    const nextRegion = initialRegion || defaultVolcanoTosRegionForLocale(locale);
    setRegion(nextRegion);
    setSelectedBucket(initialBucket || CREATE_NEW_TOS_BUCKET);
    setBucketLoadError(null);
    setServiceStatus(null);
    setBuckets([]);
    void loadBuckets(nextRegion, initialBucket || CREATE_NEW_TOS_BUCKET);
  }, [open, initialRegion, initialBucket, locale, loadBuckets]);

  const handleRegionChange = (nextRegion: string) => {
    setRegion(nextRegion);
    void loadBuckets(nextRegion, selectedBucket);
  };

  const resolveBucketName = (): string => {
    if (isCreateNewSelected) {
      return resolveNewTosBucketName(buckets, organizationId);
    }
    return selectedBucket;
  };

  const canSave =
    !isLoadingBuckets &&
    !isSaving &&
    Boolean(selectedBucket) &&
    serviceStatus !== "not_opened";

  const handleFinish = async (forceEnable?: boolean) => {
    const bucket = resolveBucketName();
    const createBucket = isCreateNewSelected;
    const enable = forceEnable ?? defaultEnable;

    if (!createBucket && enable && buckets.includes(bucket)) {
      setConfirmExistingOpen(true);
      return;
    }

    await onComplete({
      region,
      bucket,
      createBucket: createBucket && enable,
      enable,
    });
  };

  const handleConfirmExisting = async () => {
    const bucket = resolveBucketName();
    setConfirmExistingOpen(false);
    await onComplete({
      region,
      bucket,
      createBucket: false,
      enable: true,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("pages.aiInterfaces.tosStorage.setupTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("pages.aiInterfaces.tosStorage.setupRegionHint")}
              </p>
              <div className="space-y-2">
                {VOLCANO_TOS_REGIONS.map((entry) => (
                  <label
                    key={entry.code}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2",
                      region === entry.code && "border-primary bg-muted/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="tos-region"
                      checked={region === entry.code}
                      onChange={() => handleRegionChange(entry.code)}
                    />
                    <span className="text-sm">{t(entry.labelKey)}</span>
                  </label>
                ))}
              </div>
              {!wizardCredentials ? (
                <VolcanoTosPricingLines pricing={null} region={region} />
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">
                {t("pages.aiInterfaces.tosStorage.setupBucketTitle")}
              </p>
              {isLoadingBuckets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : serviceStatus === "not_opened" ? (
                <div className="rounded-md border bg-muted/30 p-3">
                  <VolcanoTosNotOpenedGuide />
                </div>
              ) : serviceStatus === "auth_error" ? (
                <VolcanoTosAuthErrorGuide />
              ) : (
                <>
                  {bucketLoadError ? (
                    <p className="text-destructive text-sm">{bucketLoadError}</p>
                  ) : null}
                  <div className="space-y-2">
                    {bucketOptions.map((option) => {
                      const isCreateNew = option === CREATE_NEW_TOS_BUCKET;
                      const isSelected = selectedBucket === option;
                      const createNewLabel = isCreateNew
                        ? `${t("pages.aiInterfaces.tosStorage.createNewBucket")} (${resolveNewTosBucketName(buckets, organizationId)})`
                        : option;

                      return (
                        <label
                          key={option}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2",
                            isSelected && "border-primary bg-muted/40"
                          )}
                        >
                          <input
                            type="radio"
                            name="tos-bucket"
                            checked={isSelected}
                            onChange={() => setSelectedBucket(option)}
                          />
                          <span className="text-sm">{createNewLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {t("pages.aiInterfaces.tosStorage.prefixHint", {
                  prefix: VOLCANO_TOS_DEFAULT_PREFIX,
                })}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!canSave} onClick={() => void handleFinish()}>
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmExistingOpen ? (
        <Dialog open={confirmExistingOpen} onOpenChange={setConfirmExistingOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t("pages.aiInterfaces.tosStorage.confirmExistingTitle")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("pages.aiInterfaces.tosStorage.confirmExistingDescription", {
                bucket: selectedBucket,
                prefix: VOLCANO_TOS_DEFAULT_PREFIX,
              })}
            </p>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmExistingOpen(false);
                  setSelectedBucket(CREATE_NEW_TOS_BUCKET);
                }}
              >
                {t("pages.aiInterfaces.tosStorage.switchToCreate")}
              </Button>
              <Button onClick={() => void handleConfirmExisting()} disabled={isSaving}>
                {t("pages.aiInterfaces.tosStorage.confirmEnable")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
