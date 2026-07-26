import {
  VOLCANO_TOS_REGIONS,
  defaultVolcanoTosRegionForLocale,
  volcanoTosPricingForRegion,
  type VolcanoTosServiceStatus,
  type VolcanoTosStorageSnapshot,
} from "@dafthunk/types";
import HardDrive from "lucide-react/icons/hard-drive";

import { useMemo, useState, useEffect } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import { updateVolcanoTosStorage, ensureVolcanoTosCors, VOLCANO_TOS_NOT_OPENED_CODE } from "@/services/organization-ai-interface-service";
import { ApiRequestError } from "@/services/utils";

import { VolcanoStorageDisableDialog } from "./volcano-storage-disable-dialog";
import { VolcanoStorageSetupDialog } from "./volcano-storage-setup-dialog";
import { VolcanoTosPricingPopover } from "./volcano-tos-pricing-popover";
import { VolcanoTosUsageMeter } from "./volcano-tos-usage-meter";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";



interface VolcanoStorageRowProps {

  readonly organizationId: string;

  readonly interfaceId: string;

  readonly snapshot: VolcanoTosStorageSnapshot;

  readonly tosServiceStatus?: VolcanoTosServiceStatus | null;

  readonly onUpdated: () => Promise<void>;

  readonly onRefreshSnapshot: () => Promise<void>;

}



export function VolcanoStorageRow({

  organizationId,

  interfaceId,

  snapshot,

  tosServiceStatus = null,

  onUpdated,

  onRefreshSnapshot,

}: VolcanoStorageRowProps) {

  const { t, locale } = useTranslation();

  const toast = useAppToast();

  const [setupOpen, setSetupOpen] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);

  const [impactWarningOpen, setImpactWarningOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);



  const regionLabel = useMemo(() => {
    const match = VOLCANO_TOS_REGIONS.find((entry) => entry.code === snapshot.region);
    return match ? t(match.labelKey) : snapshot.region;
  }, [snapshot.region, t]);

  const pricingRegion =
    snapshot.region || defaultVolcanoTosRegionForLocale(locale);
  const pricing =
    snapshot.pricing ?? volcanoTosPricingForRegion(pricingRegion);
  const pricingRegionLabel = useMemo(() => {
    const match = VOLCANO_TOS_REGIONS.find(
      (entry) => entry.code === pricingRegion
    );
    return match ? t(match.labelKey) : pricingRegion;
  }, [pricingRegion, t]);

  const hasUsageMeters =
    snapshot.storageUsage !== null || snapshot.trafficUsage !== null;

  const storageEnableBlocked =
    tosServiceStatus === "not_opened" || tosServiceStatus === "auth_error";

  useEffect(() => {
    if (!snapshot.configured || !snapshot.enabled) {
      return;
    }
    void ensureVolcanoTosCors(organizationId, interfaceId).catch(() => {
      // Health banner and storage settings surface failures.
    });
  }, [organizationId, interfaceId, snapshot.configured, snapshot.enabled]);

  const handleToggle = (checked: boolean) => {
    if (storageEnableBlocked && checked) {
      return;
    }

    if (checked) {

      if (snapshot.configured) {

        setImpactWarningOpen(true);

        return;

      }

      setSetupOpen(true);

      return;

    }

    setDisableOpen(true);

  };



  const handleConfirmEnableImpact = async () => {

    setImpactWarningOpen(false);



    if (!snapshot.configured) {

      setSetupOpen(true);

      return;

    }



    setIsSaving(true);

    try {

      await updateVolcanoTosStorage(organizationId, interfaceId, {

        enabled: true,

        region: snapshot.region,

        bucket: snapshot.bucket,

      });

      await onUpdated();

      await onRefreshSnapshot();

      toast.success("pages.aiInterfaces.tosStorage.saved");

    } catch (error) {

      toast.errorRaw(

        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")

      );

    } finally {

      setIsSaving(false);

    }

  };



  const handleSetupComplete = async (params: {

    readonly region: string;

    readonly bucket: string;

    readonly createBucket: boolean;

    readonly enable: boolean;

  }) => {

    setIsSaving(true);

    try {

      await updateVolcanoTosStorage(organizationId, interfaceId, {

        enabled: params.enable,

        region: params.region,

        bucket: params.bucket,

        createBucket: params.createBucket,

      });

      await onUpdated();

      await onRefreshSnapshot();

      toast.success("pages.aiInterfaces.tosStorage.saved");

      setSetupOpen(false);

    } catch (error) {

      if (

        error instanceof ApiRequestError &&

        error.code === VOLCANO_TOS_NOT_OPENED_CODE

      ) {

        toast.error("pages.aiInterfaces.tosStorage.notOpened.configureBlocked");

        return;

      }

      toast.errorRaw(

        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")

      );

    } finally {

      setIsSaving(false);

    }

  };



  const handleDisableConfirm = async () => {

    if (!snapshot.configured) return;

    setIsSaving(true);

    try {

      await updateVolcanoTosStorage(organizationId, interfaceId, {

        enabled: false,

        region: snapshot.region,

        bucket: snapshot.bucket,

      });

      await onUpdated();

      await onRefreshSnapshot();

      toast.success("pages.aiInterfaces.tosStorage.disabled");

      setDisableOpen(false);

    } catch (error) {

      toast.errorRaw(

        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")

      );

    } finally {

      setIsSaving(false);

    }

  };



  return (

    <>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Switch
            checked={snapshot.enabled}
            disabled={isSaving}
            onCheckedChange={(checked) => handleToggle(checked)}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {t("pages.aiInterfaces.tosStorage.cardTitle")}
              </span>
              <VolcanoTosPricingPopover
                pricing={pricing}
                region={pricingRegion}
                regionLabel={pricingRegionLabel}
              />
            </div>
            {snapshot.configured ? (
              <p className="text-muted-foreground text-xs">
                {regionLabel}
                {snapshot.bucket ? ` · ${snapshot.bucket}` : ""}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("pages.aiInterfaces.tosStorage.notConfigured")}
              </p>
            )}
            {hasUsageMeters ? (
              <div className="space-y-2 pt-1">
                <VolcanoTosUsageMeter
                  label={t("pages.aiInterfaces.tosStorage.storagePack")}
                  usage={snapshot.storageUsage}
                />
                <VolcanoTosUsageMeter
                  label={t("pages.aiInterfaces.tosStorage.trafficPack")}
                  usage={snapshot.trafficUsage}
                />
                {snapshot.usageError ? (
                  <p className="text-destructive text-xs">{snapshot.usageError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>



      <VolcanoStorageSetupDialog

        open={setupOpen}

        organizationId={organizationId}

        interfaceId={interfaceId}

        initialRegion={

          snapshot.region || defaultVolcanoTosRegionForLocale(locale)

        }

        initialBucket={snapshot.bucket}

        defaultEnable

        onOpenChange={setSetupOpen}

        onComplete={handleSetupComplete}

        isSaving={isSaving}

      />



      <VolcanoStorageDisableDialog

        open={disableOpen}

        onOpenChange={setDisableOpen}

        onConfirm={() => void handleDisableConfirm()}

        isSaving={isSaving}

      />



      {impactWarningOpen ? (

        <Dialog open={impactWarningOpen} onOpenChange={setImpactWarningOpen}>

          <DialogContent className="sm:max-w-md">

            <DialogHeader>

              <DialogTitle>

                {t("pages.aiInterfaces.tosStorage.impactTitle")}

              </DialogTitle>

            </DialogHeader>

            <p className="text-sm text-muted-foreground">

              {t("pages.aiInterfaces.tosStorage.impactDescription")}

            </p>

            <DialogFooter className="gap-2">

              <Button variant="outline" onClick={() => setImpactWarningOpen(false)}>

                {t("common.cancel")}

              </Button>

              <Button onClick={() => void handleConfirmEnableImpact()}>

                {t("common.continue")}

              </Button>

            </DialogFooter>

          </DialogContent>

        </Dialog>

      ) : null}

    </>

  );

}


