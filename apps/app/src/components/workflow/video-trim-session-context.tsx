import {
  createDefaultVideoTrimRange,
  type MediaReference,
  type VideoTrimRangeSec,
} from "@dafthunk/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type VideoTrimLoadPhase = "loading" | "ready" | "error";

export interface VideoSegmentPlaybackSeed {
  readonly videoDurationSec: number | null;
  readonly trimSourceVideoUrl: string | null;
  readonly committedRange: VideoTrimRangeSec;
  readonly draftRange: VideoTrimRangeSec;
  readonly loadPhase: VideoTrimLoadPhase;
  readonly playbackPaused: boolean;
}

export function readVideoSegmentPlaybackSeed(
  session:
    | {
        readonly sourceNodeId: string;
        readonly videoDurationSec: number | null;
        readonly trimSourceVideoUrl: string | null;
        readonly committedRange: VideoTrimRangeSec;
        readonly draftRange: VideoTrimRangeSec;
        readonly loadPhase: VideoTrimLoadPhase;
        readonly playbackPaused: boolean;
      }
    | null
    | undefined,
  sourceNodeId: string
): VideoSegmentPlaybackSeed | undefined {
  if (!session || session.sourceNodeId !== sourceNodeId) {
    return undefined;
  }
  return {
    videoDurationSec: session.videoDurationSec,
    trimSourceVideoUrl: session.trimSourceVideoUrl,
    committedRange: session.committedRange,
    draftRange: session.draftRange,
    loadPhase: session.loadPhase,
    playbackPaused: session.playbackPaused,
  };
}

export interface VideoTrimSession {
  readonly sourceNodeId: string;
  readonly sourceMedia: MediaReference;
  readonly videoDurationSec: number | null;
  readonly trimSourceVideoUrl: string | null;
  readonly committedRange: VideoTrimRangeSec;
  readonly draftRange: VideoTrimRangeSec;
  readonly loadPhase: VideoTrimLoadPhase;
  readonly highQuality: boolean;
  readonly playbackPaused: boolean;
}

interface VideoTrimSessionContextValue {
  readonly session: VideoTrimSession | null;
  readonly isTrimSessionOpen: boolean;
  readonly openTrimSession: (params: {
    readonly sourceNodeId: string;
    readonly sourceMedia: MediaReference;
    readonly seed?: VideoSegmentPlaybackSeed;
  }) => void;
  readonly closeTrimSession: () => void;
  readonly toggleTrimSession: (params: {
    readonly sourceNodeId: string;
    readonly sourceMedia: MediaReference;
  }) => void;
  readonly isTrimActiveForNode: (nodeId: string) => boolean;
  readonly patchTrimSession: (
    patch: Partial<
      Pick<
        VideoTrimSession,
        | "videoDurationSec"
        | "trimSourceVideoUrl"
        | "committedRange"
        | "draftRange"
        | "loadPhase"
        | "highQuality"
        | "playbackPaused"
      >
    >
  ) => void;
  readonly setPlaybackPaused: (paused: boolean) => void;
  readonly commitDraftRange: (range?: VideoTrimRangeSec) => void;
  readonly setDraftRange: (range: VideoTrimRangeSec) => void;
}

const VideoTrimSessionContext = createContext<VideoTrimSessionContextValue | null>(
  null
);

function rangesEqual(a: VideoTrimRangeSec, b: VideoTrimRangeSec): boolean {
  return a.startSec === b.startSec && a.endSec === b.endSec;
}

export function VideoTrimSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [session, setSession] = useState<VideoTrimSession | null>(null);

  const closeTrimSession = useCallback(() => {
    setSession(null);
  }, []);

  const openTrimSession = useCallback(
    (params: {
      readonly sourceNodeId: string;
      readonly sourceMedia: MediaReference;
      readonly seed?: VideoSegmentPlaybackSeed;
    }) => {
      const defaultRange = createDefaultVideoTrimRange(0);
      setSession({
        sourceNodeId: params.sourceNodeId,
        sourceMedia: params.sourceMedia,
        videoDurationSec: params.seed?.videoDurationSec ?? null,
        trimSourceVideoUrl: params.seed?.trimSourceVideoUrl ?? null,
        committedRange: params.seed?.committedRange ?? defaultRange,
        draftRange: params.seed?.draftRange ?? defaultRange,
        loadPhase: params.seed?.loadPhase ?? "loading",
        highQuality: false,
        playbackPaused: params.seed?.playbackPaused ?? false,
      });
    },
    []
  );

  const toggleTrimSession = useCallback(
    (params: {
      readonly sourceNodeId: string;
      readonly sourceMedia: MediaReference;
    }) => {
      setSession((current) => {
        if (current?.sourceNodeId === params.sourceNodeId) {
          return null;
        }
        const defaultRange = createDefaultVideoTrimRange(0);
        return {
          sourceNodeId: params.sourceNodeId,
          sourceMedia: params.sourceMedia,
          videoDurationSec: null,
          trimSourceVideoUrl: null,
          committedRange: defaultRange,
          draftRange: defaultRange,
          loadPhase: "loading",
          highQuality: false,
          playbackPaused: false,
        };
      });
    },
    []
  );

  const patchTrimSession = useCallback(
    (
      patch: Partial<
        Pick<
          VideoTrimSession,
          | "videoDurationSec"
          | "trimSourceVideoUrl"
          | "committedRange"
          | "draftRange"
          | "loadPhase"
          | "highQuality"
          | "playbackPaused"
        >
      >
    ) => {
      setSession((current) => {
        if (!current) {
          return current;
        }

        let next = current;

        if (
          patch.trimSourceVideoUrl !== undefined &&
          patch.trimSourceVideoUrl !== current.trimSourceVideoUrl
        ) {
          next = { ...next, trimSourceVideoUrl: patch.trimSourceVideoUrl };
        }

        if (
          patch.videoDurationSec !== undefined &&
          patch.videoDurationSec !== current.videoDurationSec
        ) {
          next = { ...next, videoDurationSec: patch.videoDurationSec };
        }

        if (
          patch.committedRange !== undefined &&
          !rangesEqual(patch.committedRange, current.committedRange)
        ) {
          next = { ...next, committedRange: patch.committedRange };
        }

        if (
          patch.draftRange !== undefined &&
          !rangesEqual(patch.draftRange, current.draftRange)
        ) {
          next = { ...next, draftRange: patch.draftRange };
        }

        if (patch.loadPhase !== undefined && patch.loadPhase !== current.loadPhase) {
          next = { ...next, loadPhase: patch.loadPhase };
        }

        if (
          patch.highQuality !== undefined &&
          patch.highQuality !== current.highQuality
        ) {
          next = { ...next, highQuality: patch.highQuality };
        }

        if (
          patch.playbackPaused !== undefined &&
          patch.playbackPaused !== current.playbackPaused
        ) {
          next = { ...next, playbackPaused: patch.playbackPaused };
        }

        return next === current ? current : next;
      });
    },
    []
  );

  const setDraftRange = useCallback((range: VideoTrimRangeSec) => {
    patchTrimSession({ draftRange: range });
  }, [patchTrimSession]);

  const setPlaybackPaused = useCallback((paused: boolean) => {
    patchTrimSession({ playbackPaused: paused });
  }, [patchTrimSession]);

  const commitDraftRange = useCallback(
    (range?: VideoTrimRangeSec) => {
      setSession((current) => {
        if (!current) {
          return current;
        }
        const nextRange = range ?? current.draftRange;
        if (
          rangesEqual(nextRange, current.committedRange) &&
          rangesEqual(nextRange, current.draftRange)
        ) {
          return current;
        }
        return {
          ...current,
          committedRange: nextRange,
          draftRange: nextRange,
        };
      });
    },
    []
  );

  const isTrimActiveForNode = useCallback(
    (nodeId: string) => session?.sourceNodeId === nodeId,
    [session?.sourceNodeId]
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTrimSession();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTrimSession, session]);

  const value = useMemo(
    (): VideoTrimSessionContextValue => ({
      session,
      isTrimSessionOpen: session !== null,
      openTrimSession,
      closeTrimSession,
      toggleTrimSession,
      isTrimActiveForNode,
      patchTrimSession,
      commitDraftRange,
      setDraftRange,
      setPlaybackPaused,
    }),
    [
      commitDraftRange,
      closeTrimSession,
      isTrimActiveForNode,
      openTrimSession,
      patchTrimSession,
      session,
      setDraftRange,
      setPlaybackPaused,
      toggleTrimSession,
    ]
  );

  return (
    <VideoTrimSessionContext.Provider value={value}>
      {children}
    </VideoTrimSessionContext.Provider>
  );
}

export function useVideoTrimSession(): VideoTrimSessionContextValue {
  const context = useContext(VideoTrimSessionContext);
  if (!context) {
    throw new Error("useVideoTrimSession must be used within VideoTrimSessionProvider");
  }
  return context;
}

export function useOptionalVideoTrimSession(): VideoTrimSessionContextValue | null {
  return useContext(VideoTrimSessionContext);
}
