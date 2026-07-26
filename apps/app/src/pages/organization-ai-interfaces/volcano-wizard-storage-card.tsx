import {
  VOLCANO_TOS_REGIONS,
  defaultVolcanoTosRegionForLocale,
  type VolcanoTosServiceStatus,
} from "@dafthunk/types";
import HardDrive from "lucide-react/icons/hard-drive";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { resolveNewTosBucketName } from "./volcano-storage-bucket-name";
import { CREATE_NEW_TOS_BUCKET } from "./volcano-storage-constants";
import { VolcanoStorageSetupDialog } from "./volcano-storage-setup-dialog";

export interface WizardTosConfig {
  readonly enabled: boolean;
  readonly region: string;
  readonly selectedBucket: string;
  readonly createBucket: boolean;
  readonly resolvedBucketName: string;
}

interface VolcanoWizardStorageCardProps {
  readonly organizationId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly config: WizardTosConfig;
  readonly serviceStatus: VolcanoTosServiceStatus | null;
  readonly onConfigChange: (config: WizardTosConfig) => void;
  readonly onServiceStatusChange?: (status: VolcanoTosServiceStatus) => void;
}

export function createDefaultWizardTosConfig(
  locale: string,
  organizationId: string,
  region?: string
): WizardTosConfig {
  const resolvedRegion = region ?? defaultVolcanoTosRegionForLocale(locale);
  const resolvedBucketName = resolveNewTosBucketName([], organizationId);
  return {
    enabled: false,
    region: resolvedRegion,
    selectedBucket: CREATE_NEW_TOS_BUCKET,
    createBucket: true,
    resolvedBucketName,
  };
}

export function VolcanoWizardStorageCard({
  organizationId,
  accessKeyId,
  secretAccessKey,
  config,
  serviceStatus,
  onConfigChange,
  onServiceStatusChange,
}: VolcanoWizardStorageCardProps) {
  const { t } = useTranslation();
  const [setupOpen, setSetupOpen] = useState(false);

  const regionLabel = useMemo(() => {
    const match = VOLCANO_TOS_REGIONS.find((entry) => entry.code === config.region);
    return match ? t(match.labelKey) : config.region;
  }, [config.region, t]);

  const bucketSummary = config.createBucket
    ? `${t("pages.aiInterfaces.tosStorage.createNewBucket")} (${config.resolvedBucketName})`
    : config.resolvedBucketName;

  const tosNotOpened = serviceStatus === "not_opened";
  const tosAuthError = serviceStatus === "auth_error";
  const storageEnableBlocked = tosNotOpened || tosAuthError;

  const handleToggle = (enabled: boolean) => {
    if (storageEnableBlocked && enabled) {
      return;
    }
    onConfigChange({ ...config, enabled });
  };

  const handleSetupComplete = async (params: {
    readonly region: string;
    readonly bucket: string;
    readonly createBucket: boolean;
    readonly enable: boolean;
  }) => {
    if (storageEnableBlocked && params.enable) {
      return;
    }
    onConfigChange({
      enabled: params.enable,
      region: params.region,
      selectedBucket: params.createBucket
        ? CREATE_NEW_TOS_BUCKET
        : params.bucket,
      createBucket: params.createBucket,
      resolvedBucketName: params.bucket,
    });
    setSetupOpen(false);
  };

  return (
    <>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Switch
            checked={config.enabled}
            disabled={storageEnableBlocked}
            onCheckedChange={handleToggle}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {t("pages.aiInterfaces.tosStorage.cardTitle")}
              </span>
            </div>
            {config.enabled ? (
              <p className="text-muted-foreground text-xs">
                {regionLabel} · {bucketSummary}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("pages.aiInterfaces.tosStorage.optOutHint")}
              </p>
            )}
            {tosNotOpened ? (
              <p className="text-muted-foreground text-xs">
                {t("pages.aiInterfaces.tosStorage.requiresTosOpen")}
              </p>
            ) : null}
            {tosAuthError ? (
              <p className="text-destructive text-xs">
                {t("pages.aiInterfaces.tosStorage.authErrorHint")}
              </p>
            ) : null}
            {config.enabled ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setSetupOpen(true)}
              >
                {t("pages.aiInterfaces.tosStorage.reconfigure")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <VolcanoStorageSetupDialog
        open={setupOpen}
        organizationId={organizationId}
        wizardCredentials={{
          accessKeyId,
          secretAccessKey,
        }}
        initialRegion={config.region}
        initialBucket={config.selectedBucket}
        defaultEnable={config.enabled}
        onOpenChange={setSetupOpen}
        onComplete={handleSetupComplete}
        onServiceStatusChange={onServiceStatusChange}
        isSaving={false}
      />
    </>
  );
}
