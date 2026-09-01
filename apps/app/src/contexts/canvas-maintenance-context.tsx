import type { PublicSiteSettings } from "@dafthunk/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CanvasMaintenanceOverlay } from "@/components/workflow/canvas-maintenance-overlay";
import { setCanvasMaintenanceFrozen } from "@/lib/canvas-maintenance-freeze";
import { subscribeWorkflowPublicState } from "@/lib/workflow-public-maintenance-bridge";
import { makeRequest } from "@/services/utils";

interface CanvasMaintenanceContextValue {
  readonly isCanvasFrozen: boolean;
  readonly maintenanceMessage: string | null;
  readonly statusFetchFailed: boolean;
  readonly refreshMaintenanceStatus: () => Promise<void>;
}

const CanvasMaintenanceContext =
  createContext<CanvasMaintenanceContextValue | null>(null);

async function fetchCanvasMaintenanceStatus(): Promise<{
  readonly frozen: boolean;
  readonly message: string | null;
  readonly fetchFailed: boolean;
}> {
  try {
    const settings = await makeRequest<PublicSiteSettings>(
      "/site-settings",
      {},
      true
    );
    return {
      frozen: settings.maintenanceEnabled,
      message: settings.maintenanceMessage,
      fetchFailed: false,
    };
  } catch {
    return {
      frozen: true,
      message: null,
      fetchFailed: true,
    };
  }
}

export function CanvasMaintenanceProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [isCanvasFrozen, setIsCanvasFrozen] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(
    null
  );
  const [statusFetchFailed, setStatusFetchFailed] = useState(false);

  const applyPublicMaintenance = useCallback(
    (frozen: boolean, message: string | null) => {
      setMaintenanceChecked(true);
      setIsCanvasFrozen(frozen);
      setMaintenanceMessage(message);
      setStatusFetchFailed(false);
      setCanvasMaintenanceFrozen(frozen);
    },
    []
  );

  const refreshMaintenanceStatus = useCallback(async () => {
    const result = await fetchCanvasMaintenanceStatus();
    setMaintenanceChecked(true);
    setIsCanvasFrozen(result.frozen);
    setMaintenanceMessage(result.message);
    setStatusFetchFailed(result.fetchFailed);
    setCanvasMaintenanceFrozen(result.frozen);
  }, []);

  useEffect(() => {
    void refreshMaintenanceStatus();
  }, [refreshMaintenanceStatus]);

  useEffect(() => {
    return subscribeWorkflowPublicState((publicState) => {
      applyPublicMaintenance(
        publicState.maintenanceEnabled,
        publicState.maintenanceMessage
      );
    });
  }, [applyPublicMaintenance]);

  useEffect(() => {
    return () => {
      setCanvasMaintenanceFrozen(false);
    };
  }, []);

  const value = useMemo(
    () => ({
      isCanvasFrozen,
      maintenanceMessage,
      statusFetchFailed,
      refreshMaintenanceStatus,
    }),
    [
      isCanvasFrozen,
      maintenanceMessage,
      refreshMaintenanceStatus,
      statusFetchFailed,
    ]
  );

  return (
    <CanvasMaintenanceContext.Provider value={value}>
      {children}
      {maintenanceChecked && isCanvasFrozen ? (
        <CanvasMaintenanceOverlay
          message={maintenanceMessage}
          statusFetchFailed={statusFetchFailed}
          onRefreshStatus={() => {
            void refreshMaintenanceStatus();
          }}
        />
      ) : null}
    </CanvasMaintenanceContext.Provider>
  );
}

export function useCanvasMaintenance(): CanvasMaintenanceContextValue {
  const value = useContext(CanvasMaintenanceContext);
  if (!value) {
    throw new Error(
      "useCanvasMaintenance must be used within CanvasMaintenanceProvider"
    );
  }
  return value;
}

export function useOptionalCanvasMaintenance():
  | CanvasMaintenanceContextValue
  | null {
  return useContext(CanvasMaintenanceContext);
}
