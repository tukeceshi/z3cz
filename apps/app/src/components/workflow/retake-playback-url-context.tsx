import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { revokeTrimObjectUrl } from "./video-trim-utils";

interface RetakePlaybackEntry {
  readonly url: string;
  readonly mediaKey: string | null;
}

interface RetakePlaybackUrlContextValue {
  readonly getPlaybackUrl: (nodeId: string) => string | null;
  readonly setPlaybackUrl: (
    nodeId: string,
    url: string | null,
    mediaKey?: string | null
  ) => void;
}

const RetakePlaybackUrlContext =
  createContext<RetakePlaybackUrlContextValue | null>(null);

export function RetakePlaybackUrlProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [entries, setEntries] = useState<
    Readonly<Record<string, RetakePlaybackEntry>>
  >({});

  const setPlaybackUrl = useCallback(
    (nodeId: string, url: string | null, mediaKey: string | null = null) => {
      setEntries((current) => {
        const previous = current[nodeId];
        if (url && previous?.url === url && previous.mediaKey === mediaKey) {
          return current;
        }
        if (previous?.url && previous.url !== url) {
          revokeTrimObjectUrl(previous.url);
        }
        if (!url) {
          if (!previous) {
            return current;
          }
          const next = { ...current };
          delete next[nodeId];
          return next;
        }
        return {
          ...current,
          [nodeId]: { url, mediaKey },
        };
      });
    },
    []
  );

  const getPlaybackUrl = useCallback(
    (nodeId: string) => entries[nodeId]?.url ?? null,
    [entries]
  );

  const value = useMemo(
    (): RetakePlaybackUrlContextValue => ({
      getPlaybackUrl,
      setPlaybackUrl,
    }),
    [getPlaybackUrl, setPlaybackUrl]
  );

  return (
    <RetakePlaybackUrlContext.Provider value={value}>
      {children}
    </RetakePlaybackUrlContext.Provider>
  );
}

export function useRetakePlaybackUrlContext(): RetakePlaybackUrlContextValue {
  const context = useContext(RetakePlaybackUrlContext);
  if (!context) {
    throw new Error(
      "useRetakePlaybackUrlContext must be used within RetakePlaybackUrlProvider"
    );
  }
  return context;
}

export function useOptionalRetakePlaybackUrlContext(): RetakePlaybackUrlContextValue | null {
  return useContext(RetakePlaybackUrlContext);
}

export function useRetakePlaybackUrl(nodeId: string): string | null {
  const context = useOptionalRetakePlaybackUrlContext();
  return context?.getPlaybackUrl(nodeId) ?? null;
}
