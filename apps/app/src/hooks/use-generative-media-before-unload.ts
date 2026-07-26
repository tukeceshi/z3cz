import { useEffect, useSyncExternalStore } from "react";

import {
  beginGenerativeMediaWork,
  isGenerativeMediaWorkActive,
  subscribeGenerativeMediaWork,
} from "@/utils/generative-media-active-work";

export function useGenerativeMediaBeforeUnloadGuard(): void {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isGenerativeMediaWorkActive()) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}

export function useGenerativeMediaWorkSession(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    return beginGenerativeMediaWork();
  }, [active]);
}

export function useGenerativeMediaWorkActive(): boolean {
  return useSyncExternalStore(
    subscribeGenerativeMediaWork,
    isGenerativeMediaWorkActive,
    () => false
  );
}
