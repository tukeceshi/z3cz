import {
  createDefaultVideoRetakeTrimRange,
  type MediaReference,
  type VideoTrimRangeSec,
} from "@dafthunk/types";

import type { VideoSegmentPlaybackSeed } from "./video-trim-session-context";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type VideoRetakeLoadPhase = "loading" | "ready" | "error";

export interface VideoRetakeSession {
  readonly sourceNodeId: string;
  readonly sourceMedia: MediaReference;
  readonly videoDurationSec: number | null;
  readonly sourceVideoWidth: number | null;
  readonly sourceVideoHeight: number | null;
  readonly trimSourceVideoUrl: string | null;
  readonly committedRange: VideoTrimRangeSec;
  readonly draftRange: VideoTrimRangeSec;
  readonly loadPhase: VideoRetakeLoadPhase;
  readonly highQuality: boolean;
  readonly playbackPaused: boolean;
  readonly prompt: string;
  readonly selectedModelOptionId: string | null;
  readonly generationParams: Readonly<Record<string, unknown>>;
}

interface VideoRetakeSessionContextValue {
  readonly session: VideoRetakeSession | null;
  readonly isRetakeSessionOpen: boolean;
  readonly openRetakeSession: (params: {
    readonly sourceNodeId: string;
    readonly sourceMedia: MediaReference;
    readonly seed?: VideoSegmentPlaybackSeed;
  }) => void;
  readonly closeRetakeSession: () => void;
  readonly toggleRetakeSession: (params: {
    readonly sourceNodeId: string;
    readonly sourceMedia: MediaReference;
  }) => void;
  readonly isRetakeActiveForNode: (nodeId: string) => boolean;
  readonly patchRetakeSession: (
    patch: Partial<
      Pick<
        VideoRetakeSession,
        | "videoDurationSec"
        | "sourceVideoWidth"
        | "sourceVideoHeight"
        | "trimSourceVideoUrl"
        | "committedRange"
        | "draftRange"
        | "loadPhase"
        | "highQuality"
        | "playbackPaused"
        | "prompt"
        | "selectedModelOptionId"
        | "generationParams"
      >
    >
  ) => void;
  readonly setPlaybackPaused: (paused: boolean) => void;
  readonly commitDraftRange: (range?: VideoTrimRangeSec) => void;
  readonly setDraftRange: (range: VideoTrimRangeSec) => void;
}

const VideoRetakeSessionContext =
  createContext<VideoRetakeSessionContextValue | null>(null);

function rangesEqual(a: VideoTrimRangeSec, b: VideoTrimRangeSec): boolean {
  return a.startSec === b.startSec && a.endSec === b.endSec;
}

export function VideoRetakeSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [session, setSession] = useState<VideoRetakeSession | null>(null);

  const closeRetakeSession = useCallback(() => {
    setSession(null);
  }, []);

  const openRetakeSession = useCallback(
    (params: {
      readonly sourceNodeId: string;
      readonly sourceMedia: MediaReference;
      readonly seed?: VideoSegmentPlaybackSeed;
    }) => {
      const defaultRange = createDefaultVideoRetakeTrimRange(0);
      setSession({
        sourceNodeId: params.sourceNodeId,
        sourceMedia: params.sourceMedia,
        videoDurationSec: params.seed?.videoDurationSec ?? null,
        sourceVideoWidth: null,
        sourceVideoHeight: null,
        trimSourceVideoUrl: params.seed?.trimSourceVideoUrl ?? null,
        committedRange: params.seed?.committedRange ?? defaultRange,
        draftRange: params.seed?.draftRange ?? defaultRange,
        loadPhase: params.seed?.loadPhase ?? "loading",
        highQuality: false,
        playbackPaused: params.seed?.playbackPaused ?? false,
        prompt: "",
        selectedModelOptionId: null,
        generationParams: {},
      });
    },
    []
  );

  const toggleRetakeSession = useCallback(
    (params: {
      readonly sourceNodeId: string;
      readonly sourceMedia: MediaReference;
    }) => {
      setSession((current) => {
        if (current?.sourceNodeId === params.sourceNodeId) {
          return null;
        }
        const defaultRange = createDefaultVideoRetakeTrimRange(0);
        return {
          sourceNodeId: params.sourceNodeId,
          sourceMedia: params.sourceMedia,
          videoDurationSec: null,
          sourceVideoWidth: null,
          sourceVideoHeight: null,
          trimSourceVideoUrl: null,
          committedRange: defaultRange,
          draftRange: defaultRange,
          loadPhase: "loading",
          highQuality: false,
          playbackPaused: false,
          prompt: "",
          selectedModelOptionId: null,
          generationParams: {},
        };
      });
    },
    []
  );

  const patchRetakeSession = useCallback(
    (
      patch: Partial<
        Pick<
          VideoRetakeSession,
          | "videoDurationSec"
          | "sourceVideoWidth"
          | "sourceVideoHeight"
          | "trimSourceVideoUrl"
          | "committedRange"
          | "draftRange"
          | "loadPhase"
          | "highQuality"
          | "playbackPaused"
          | "prompt"
          | "selectedModelOptionId"
          | "generationParams"
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
          patch.sourceVideoWidth !== undefined &&
          patch.sourceVideoWidth !== current.sourceVideoWidth
        ) {
          next = { ...next, sourceVideoWidth: patch.sourceVideoWidth };
        }

        if (
          patch.sourceVideoHeight !== undefined &&
          patch.sourceVideoHeight !== current.sourceVideoHeight
        ) {
          next = { ...next, sourceVideoHeight: patch.sourceVideoHeight };
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

        if (patch.prompt !== undefined && patch.prompt !== current.prompt) {
          next = { ...next, prompt: patch.prompt };
        }

        if (
          patch.selectedModelOptionId !== undefined &&
          patch.selectedModelOptionId !== current.selectedModelOptionId
        ) {
          next = { ...next, selectedModelOptionId: patch.selectedModelOptionId };
        }

        if (
          patch.generationParams !== undefined &&
          patch.generationParams !== current.generationParams
        ) {
          next = { ...next, generationParams: patch.generationParams };
        }

        return next === current ? current : next;
      });
    },
    []
  );

  const setDraftRange = useCallback(
    (range: VideoTrimRangeSec) => {
      patchRetakeSession({ draftRange: range });
    },
    [patchRetakeSession]
  );

  const setPlaybackPaused = useCallback(
    (paused: boolean) => {
      patchRetakeSession({ playbackPaused: paused });
    },
    [patchRetakeSession]
  );

  const commitDraftRange = useCallback((range?: VideoTrimRangeSec) => {
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
  }, []);

  const isRetakeActiveForNode = useCallback(
    (nodeId: string) => session?.sourceNodeId === nodeId,
    [session?.sourceNodeId]
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRetakeSession();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeRetakeSession, session]);

  const value = useMemo(
    (): VideoRetakeSessionContextValue => ({
      session,
      isRetakeSessionOpen: session !== null,
      openRetakeSession,
      closeRetakeSession,
      toggleRetakeSession,
      isRetakeActiveForNode,
      patchRetakeSession,
      commitDraftRange,
      setDraftRange,
      setPlaybackPaused,
    }),
    [
      commitDraftRange,
      closeRetakeSession,
      isRetakeActiveForNode,
      openRetakeSession,
      patchRetakeSession,
      session,
      setDraftRange,
      setPlaybackPaused,
      toggleRetakeSession,
    ]
  );

  return (
    <VideoRetakeSessionContext.Provider value={value}>
      {children}
    </VideoRetakeSessionContext.Provider>
  );
}

export function useVideoRetakeSession(): VideoRetakeSessionContextValue {
  const context = useContext(VideoRetakeSessionContext);
  if (!context) {
    throw new Error(
      "useVideoRetakeSession must be used within VideoRetakeSessionProvider"
    );
  }
  return context;
}

export function useOptionalVideoRetakeSession(): VideoRetakeSessionContextValue | null {
  return useContext(VideoRetakeSessionContext);
}
