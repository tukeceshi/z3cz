import { useEffect, useState } from "react";

import { batchLoadWorkflowMediaThumbBlobs } from "@/services/ai-media-cache-service";
import {
  initWorkflowMediaAddressCatalog,
  isWorkflowMediaAddressCatalogReady,
  resetWorkflowMediaAddressCatalog,
} from "@/services/workflow-media-address-catalog";

export function useWorkflowMediaAddressCatalogInit(
  organizationId: string | undefined,
  workflowId: string | undefined
): boolean {
  const [ready, setReady] = useState(() =>
    organizationId && workflowId
      ? isWorkflowMediaAddressCatalogReady({
          organizationId,
          workflowId,
        })
      : false
  );

  useEffect(() => {
    if (!organizationId || !workflowId) {
      resetWorkflowMediaAddressCatalog();
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);

    void initWorkflowMediaAddressCatalog(
      { organizationId, workflowId },
      batchLoadWorkflowMediaThumbBlobs
    ).finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      resetWorkflowMediaAddressCatalog();
    };
  }, [organizationId, workflowId]);

  return ready;
}
