import {
  VOLCANO_TOS_DEFAULT_PREFIX,
  VOLCANO_TOS_REGIONS,
  defaultVolcanoTosRegionForLocale,
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
import { listVolcanoTosBuckets } from "@/services/organization-ai-interface-service";
import { cn } from "@/utils/utils";

import { resolveNewTosBucketName } from "./volcano-storage-bucket-name";
import { CREATE_NEW_TOS_BUCKET } from "./volcano-storage-constants";
import { VolcanoTosPricingLines } from "./volcano-tos-pricing-lines";

interface VolcanoStorageSetupDialogProps {
  readonly open: boolean;
  readonly organizationId: string;
  readonly interfaceId: string;
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
  readonly isSaving: boolean;
  readonly showSkip?: boolean;
  readonly onSkip?: () => void;
}

export function VolcanoStorageSetupDialog({
  open,
  organizationId,
  interfaceId,
  initialRegion,
  initialBucket,
  defaultEnable,
  onOpenChange,
  onComplete,
  isSaving,
  showSkip,
  onSkip,
}: VolcanoStorageSetupDialogProps) {
  const { t, locale } = useTranslation();
  const [step, setStep] = useState<"region" | "bucket">("region");
  const [region, setRegion] = useState(
    initialRegion || defaultVolcanoTosRegionForLocale(locale)
  );
  const [buckets, setBuckets] = useState<readonly string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState(
    initialBucket || CREATE_NEW_TOS_BUCKET
  );
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
  const [bucketLoadError, setBucketLoadError] = useState<string | null>(null);
  const [confirmExistingOpen, setConfirmExistingOpen] = useState(false);

  const isCreateNewSelected = selectedBucket === CREATE_NEW_TOS_BUCKET;

  const bucketOptions = useMemo(
    () => [...buckets, CREATE_NEW_TOS_BUCKET] as const,
    [buckets]
  );

  useEffect(() => {
    if (!open) return;
    setStep("region");
    setRegion(initialRegion || defaultVolcanoTosRegionForLocale(locale));
    setSelectedBucket(initialBucket || CREATE_NEW_TOS_BUCKET);
    setBucketLoadError(null);
    setBuckets([]);
  }, [open, initialRegion, initialBucket, locale]);

  const loadBuckets = useCallback(async () => {
    setIsLoadingBuckets(true);
    setBucketLoadError(null);
    try {
      const listed = await listVolcanoTosBuckets(
        organizationId,
        interfaceId,
        region
      );
      setBuckets(listed);
      if (initialBucket && listed.includes(initialBucket)) {
        setSelectedBucket(initialBucket);
      } else if (listed.length > 0) {
        setSelectedBucket(listed[0]!);
      } else {
        setSelectedBucket(CREATE_NEW_TOS_BUCKET);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.saveFailed");
      setBucketLoadError(message);
      setBuckets([]);
      setSelectedBucket(CREATE_NEW_TOS_BUCKET);
    } finally {
      setIsLoadingBuckets(false);
    }
  }, [initialBucket, interfaceId, organizationId, region, t]);

  const handleRegionNext = async () => {
    setStep("bucket");
    await loadBuckets();
  };

  const resolveBucketName = (): string => {
    if (isCreateNewSelected) {
      return resolveNewTosBucketName(buckets);
    }
    return selectedBucket;
  };

  const canSave = !isLoadingBuckets && !isSaving && Boolean(selectedBucket);

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
              {step === "region"
                ? t("pages.aiInterfaces.tosStorage.setupRegionTitle")
                : t("pages.aiInterfaces.tosStorage.setupBucketTitle")}
            </DialogTitle>
          </DialogHeader>

          {step === "region" ? (
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
                      onChange={() => setRegion(entry.code)}
                    />
                    <span className="text-sm">{t(entry.labelKey)}</span>
                  </label>
                ))}
              </div>
              <VolcanoTosPricingLines
                pricing={null}
                region={region}
              />
            </div>
          ) : null}

          {step === "bucket" ? (
            <div className="space-y-3">
              {isLoadingBuckets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : (
                <>
                  {bucketLoadError ? (
                    <p className="text-destructive text-sm">{bucketLoadError}</p>
                  ) : null}
                  <div className="space-y-2">
                    {bucketOptions.map((option) => {
                      const isCreateNew = option === CREATE_NEW_TOS_BUCKET;
                      const isSelected = selectedBucket === option;

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
                          <span className="text-sm">
                            {isCreateNew
                              ? t("pages.aiInterfaces.tosStorage.createNewBucket")
                              : option}
                          </span>
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
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {showSkip && onSkip ? (
              <Button variant="ghost" onClick={onSkip}>
                {t("pages.aiInterfaces.tosStorage.wizardSkip")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {step === "bucket" ? (
                <Button variant="outline" onClick={() => setStep("region")}>
                  {t("common.back")}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              {step === "region" ? (
                <Button onClick={() => void handleRegionNext()}>
                  {t("common.next")}
                </Button>
              ) : (
                <Button disabled={!canSave} onClick={() => void handleFinish()}>
                  {isSaving ? t("common.saving") : t("common.save")}
                </Button>
              )}
            </div>
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
