import type { CloudStorageHealthSnapshot } from "@dafthunk/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ensureDirectUploadCorsForOrg,
  fetchOrgCloudStorageConfigured,
  fetchOrgCloudStorageHealth,
} from "@/services/platform-ai-model-service";
import {
  registerCloudStorageErrorReporter,
  unregisterCloudStorageErrorReporter,
  type CloudStorageErrorSource,
} from "@/services/cloud-storage-error-reporter";

const DISCOVER_INTERVAL_MS = 30_000;
const RECOVER_INTERVAL_MS = 30_000;
const RECOVER_MAX_ATTEMPTS = 10;

type PollingMode = "off" | "discover" | "idle" | "recover";
export type CloudStorageAutoFixState = "idle" | "fixing_cors" | "failed";

interface CloudStorageCanvasContextValue {
  readonly configured: boolean;
  readonly blocksGenerativeMedia: boolean;
  readonly health: CloudStorageHealthSnapshot | null;
  readonly isLoading: boolean;
  readonly autoFixState: CloudStorageAutoFixState;
  readonly reportCloudStorageError: (source: CloudStorageErrorSource) => void;
}

const CloudStorageCanvasContext =
  createContext<CloudStorageCanvasContextValue | null>(null);

export function useCloudStorageCanvasContext(): CloudStorageCanvasContextValue {
  const value = useContext(CloudStorageCanvasContext);
  if (!value) {
    throw new Error(
      "useCloudStorageCanvasContext must be used within CloudStorageCanvasProvider"
    );
  }
  return value;
}

interface CloudStorageCanvasProviderProps {
  readonly orgId: string;
  readonly enabled: boolean;
  readonly children: ReactNode;
}

export function CloudStorageCanvasProvider({
  orgId,
  enabled,
  children,
}: CloudStorageCanvasProviderProps) {
  const [pollingMode, setPollingMode] = useState<PollingMode>("off");
  const [configured, setConfigured] = useState(false);
  const [health, setHealth] = useState<CloudStorageHealthSnapshot | null>(null);
  const [blocksGenerativeMedia, setBlocksGenerativeMedia] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoFixState, setAutoFixState] =
    useState<CloudStorageAutoFixState>("idle");
  const recoverAttemptsRef = useRef(0);
  const corsEnsureInFlightRef = useRef(false);
  const autoFixStateRef = useRef<CloudStorageAutoFixState>("idle");

  const reportCloudStorageError = useCallback(
    (source: CloudStorageErrorSource) => {
      setPollingMode("recover");
      recoverAttemptsRef.current = 0;
      corsEnsureInFlightRef.current = false;
      const nextAutoFixState = source === "cors_upload" ? "fixing_cors" : "idle";
      autoFixStateRef.current = nextAutoFixState;
      setAutoFixState(nextAutoFixState);
    },
    []
  );

  useEffect(() => {
    autoFixStateRef.current = autoFixState;
  }, [autoFixState]);

  useEffect(() => {
    if (!enabled) {
      setPollingMode("off");
      return;
    }
    setPollingMode("discover");
    setIsLoading(true);
    recoverAttemptsRef.current = 0;
    corsEnsureInFlightRef.current = false;
    autoFixStateRef.current = "idle";
    setAutoFixState("idle");
    setHealth(null);
    setBlocksGenerativeMedia(false);
  }, [orgId, enabled]);

  useEffect(() => {
    registerCloudStorageErrorReporter(reportCloudStorageError);
    return () => unregisterCloudStorageErrorReporter();
  }, [reportCloudStorageError]);

  useEffect(() => {
    if (!enabled || !orgId || pollingMode !== "discover") {
      return;
    }

    let cancelled = false;

    const runDiscover = async (): Promise<void> => {
      try {
        const status = await fetchOrgCloudStorageConfigured(orgId);
        if (cancelled) return;
        setConfigured(status.configured);
        setIsLoading(false);
        if (status.configured) {
          setPollingMode("idle");
          setBlocksGenerativeMedia(false);
          setHealth(null);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void runDiscover();
    const intervalId = window.setInterval(runDiscover, DISCOVER_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, orgId, pollingMode]);

  useEffect(() => {
    if (!enabled || !orgId || pollingMode !== "recover") {
      return;
    }

    let cancelled = false;
    const pageOrigin = window.location.origin;

    const runRecover = async (): Promise<void> => {
      if (recoverAttemptsRef.current >= RECOVER_MAX_ATTEMPTS) {
        if (!cancelled) {
          setPollingMode("idle");
          if (autoFixStateRef.current === "fixing_cors") {
            autoFixStateRef.current = "failed";
            setAutoFixState("failed");
          }
        }
        return;
      }
      recoverAttemptsRef.current += 1;

      const force = recoverAttemptsRef.current === 1;

      try {
        let status = await fetchOrgCloudStorageHealth(orgId, {
          force,
          origin: pageOrigin,
        });
        if (cancelled) return;

        setConfigured(status.configured);
        setHealth(status.health ?? null);
        setBlocksGenerativeMedia(status.blocksGenerativeMedia);
        setIsLoading(false);

        const needsCorsFix =
          status.health?.reason === "cors_not_configured" ||
          autoFixStateRef.current === "fixing_cors";

        if (needsCorsFix && !corsEnsureInFlightRef.current) {
          corsEnsureInFlightRef.current = true;
          autoFixStateRef.current = "fixing_cors";
          setAutoFixState("fixing_cors");
          try {
            await ensureDirectUploadCorsForOrg(orgId, pageOrigin);
            status = await fetchOrgCloudStorageHealth(orgId, {
              force: true,
              origin: pageOrigin,
            });
            if (cancelled) return;
            setHealth(status.health ?? null);
            setBlocksGenerativeMedia(status.blocksGenerativeMedia);
          } catch {
            // Continue recovery polling.
          } finally {
            corsEnsureInFlightRef.current = false;
          }
        }

        if (status.health?.status === "healthy" && !status.blocksGenerativeMedia) {
          setPollingMode("idle");
          autoFixStateRef.current = "idle";
          setAutoFixState("idle");
          return;
        }

        if (
          status.blocksGenerativeMedia &&
          status.health?.reason !== "cors_not_configured" &&
          autoFixStateRef.current === "fixing_cors"
        ) {
          autoFixStateRef.current = "failed";
          setAutoFixState("failed");
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void runRecover();
    const intervalId = window.setInterval(runRecover, RECOVER_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, orgId, pollingMode]);

  const value = useMemo(
    () => ({
      configured,
      blocksGenerativeMedia,
      health,
      isLoading,
      autoFixState,
      reportCloudStorageError,
    }),
    [
      configured,
      blocksGenerativeMedia,
      health,
      isLoading,
      autoFixState,
      reportCloudStorageError,
    ]
  );

  return (
    <CloudStorageCanvasContext.Provider value={value}>
      {children}
    </CloudStorageCanvasContext.Provider>
  );
}
