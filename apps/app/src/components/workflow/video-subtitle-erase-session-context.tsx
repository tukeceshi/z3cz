import {
  clampVideoSubtitleEraseRect,
  type MediaReference,
  type VideoSubtitleEraseNodeConfig,
  type VideoSubtitleEraseRect,
} from "@dafthunk/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface SubtitleEraseSession {
  readonly sourceNodeId: string;
  readonly sourceMedia: MediaReference;
  readonly draftConfig: VideoSubtitleEraseNodeConfig;
  readonly regionMode: boolean;
  readonly regions: readonly VideoSubtitleEraseRect[];
}

interface SubtitleEraseSessionContextValue {
  readonly session: SubtitleEraseSession | null;
  readonly isSubtitleEraseActiveForNode: (nodeId: string) => boolean;
  readonly openSubtitleEraseSession: (params: {
    readonly sourceNodeId: string;
    readonly sourceMedia: MediaReference;
    readonly draftConfig: VideoSubtitleEraseNodeConfig;
  }) => void;
  readonly closeSubtitleEraseSession: () => void;
  readonly patchDraftConfig: (
    patch: Partial<VideoSubtitleEraseNodeConfig>
  ) => void;
  readonly setRegionMode: (active: boolean) => void;
  readonly setRegions: (next: readonly VideoSubtitleEraseRect[]) => void;
}

const SubtitleEraseSessionContext =
  createContext<SubtitleEraseSessionContextValue | null>(null);

export function SubtitleEraseSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [session, setSession] = useState<SubtitleEraseSession | null>(null);

  const closeSubtitleEraseSession = useCallback(() => {
    setSession(null);
  }, []);

  const openSubtitleEraseSession = useCallback(
    (params: {
      readonly sourceNodeId: string;
      readonly sourceMedia: MediaReference;
      readonly draftConfig: VideoSubtitleEraseNodeConfig;
    }) => {
      setSession({
        sourceNodeId: params.sourceNodeId,
        sourceMedia: params.sourceMedia,
        draftConfig: params.draftConfig,
        regionMode: false,
        regions: params.draftConfig.eraseRatioLocation ?? [],
      });
    },
    []
  );

  const patchDraftConfig = useCallback(
    (patch: Partial<VideoSubtitleEraseNodeConfig>) => {
      setSession((current) =>
        current
          ? { ...current, draftConfig: { ...current.draftConfig, ...patch } }
          : current
      );
    },
    []
  );

  const setRegionMode = useCallback((active: boolean) => {
    setSession((current) =>
      current ? { ...current, regionMode: active } : current
    );
  }, []);

  const setRegions = useCallback(
    (next: readonly VideoSubtitleEraseRect[]) => {
      const normalized = next.map(clampVideoSubtitleEraseRect);
      setSession((current) => {
        if (!current) {
          return current;
        }
        const refined = current.draftConfig.mode === "refined";
        return {
          ...current,
          regions: normalized,
          draftConfig: refined
            ? {
                ...current.draftConfig,
                ...(normalized.length > 0
                  ? { eraseRatioLocation: normalized }
                  : { eraseRatioLocation: undefined }),
              }
            : current.draftConfig,
        };
      });
    },
    []
  );

  const isSubtitleEraseActiveForNode = useCallback(
    (nodeId: string) => session?.sourceNodeId === nodeId,
    [session?.sourceNodeId]
  );

  const value = useMemo(
    () => ({
      session,
      isSubtitleEraseActiveForNode,
      openSubtitleEraseSession,
      closeSubtitleEraseSession,
      patchDraftConfig,
      setRegionMode,
      setRegions,
    }),
    [
      closeSubtitleEraseSession,
      isSubtitleEraseActiveForNode,
      openSubtitleEraseSession,
      patchDraftConfig,
      session,
      setRegionMode,
      setRegions,
    ]
  );

  return (
    <SubtitleEraseSessionContext.Provider value={value}>
      {children}
    </SubtitleEraseSessionContext.Provider>
  );
}

export function useSubtitleEraseSession(): SubtitleEraseSessionContextValue {
  const value = useContext(SubtitleEraseSessionContext);
  if (!value) {
    throw new Error(
      "useSubtitleEraseSession must be used within SubtitleEraseSessionProvider"
    );
  }
  return value;
}

export function useOptionalSubtitleEraseSession(): SubtitleEraseSessionContextValue | null {
  return useContext(SubtitleEraseSessionContext);
}
