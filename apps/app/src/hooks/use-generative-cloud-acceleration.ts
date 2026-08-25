import { useCallback, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  enableAlwaysOrgInterfaceCloudAcceleration,
} from "@/services/cloud-acceleration-service";
import { requestGenerationJobServerPersist } from "@/services/platform-ai-model-service";

interface UseGenerativeCloudAccelerationOptions {
  readonly organizationId: string | undefined;
  readonly aiInterfaceId: string | undefined;
  readonly jobId: string | undefined;
  readonly enabled: boolean;
  readonly onServerPersistTriggered?: () => void;
}

export function useGenerativeCloudAcceleration(
  options: UseGenerativeCloudAccelerationOptions
) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const [offerVisible, setOfferVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const abortDownloadRef = useRef(false);
  const pendingServerPersistRef = useRef(false);

  const resetOffer = useCallback(() => {
    setOfferVisible(false);
    setDialogOpen(false);
    abortDownloadRef.current = false;
    pendingServerPersistRef.current = false;
  }, []);

  const onDownloadSlow = useCallback(() => {
    if (!options.enabled) {
      return;
    }
    setOfferVisible(true);
  }, [options.enabled]);

  const shouldAbortDownload = useCallback(() => {
    return abortDownloadRef.current || pendingServerPersistRef.current;
  }, []);

  const triggerServerPersist = useCallback(
    async (alwaysForInterface: boolean) => {
      if (!options.organizationId || !options.jobId) {
        return;
      }

      pendingServerPersistRef.current = true;
      abortDownloadRef.current = true;
      setDialogOpen(false);
      setOfferVisible(false);
      options.onServerPersistTriggered?.();

      try {
        if (alwaysForInterface && options.aiInterfaceId) {
          await enableAlwaysOrgInterfaceCloudAcceleration(
            options.organizationId,
            options.aiInterfaceId
          );
          toast.success(t("pages.cloudAcceleration.alwaysEnabled"));
        }
        await requestGenerationJobServerPersist(
          options.organizationId,
          options.jobId
        );
      } catch {
        pendingServerPersistRef.current = false;
        abortDownloadRef.current = false;
        toast.error(t("pages.cloudAcceleration.requestFailed"));
      }
    },
    [
      options.aiInterfaceId,
      options.jobId,
      options.onServerPersistTriggered,
      options.organizationId,
      t,
      toast,
    ]
  );

  return {
    offerVisible: options.enabled && offerVisible,
    dialogOpen,
    setDialogOpen,
    onDownloadSlow,
    shouldAbortDownload,
    resetOffer,
    triggerServerPersist,
  };
}
