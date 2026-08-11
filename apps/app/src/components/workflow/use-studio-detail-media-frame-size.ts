import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import {
  fitStudioDetailSize,
  type StudioDetailSize,
} from "./creative-studio-detail-size";

const DEFAULT_DETAIL_ASPECT_RATIO = 16 / 9;

interface StudioDetailBounds {
  readonly width: number;
  readonly height: number;
}

interface StudioMediaIntrinsicSize {
  readonly width: number;
  readonly height: number;
}

function readStudioDetailContentBounds(element: HTMLDivElement): StudioDetailBounds {
  const style = getComputedStyle(element);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  return {
    width: Math.max(0, element.clientWidth - padX),
    height: Math.max(0, element.clientHeight - padY),
  };
}

export function applyStudioDetailMediaNaturalSize(
  width: number,
  height: number,
  setAspectRatio: (ratio: number) => void,
  setNaturalSize: (size: StudioMediaIntrinsicSize) => void
): void {
  if (width > 0 && height > 0) {
    setAspectRatio(width / height);
    setNaturalSize({ width, height });
  }
}

export function useStudioDetailMediaFrameSize(mediaKey: string | null): {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly displaySize: StudioDetailSize | null;
  readonly applyPrimaryNaturalSize: (width: number, height: number) => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<StudioDetailBounds>({ width: 0, height: 0 });
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_DETAIL_ASPECT_RATIO);
  const [naturalSize, setNaturalSize] = useState<StudioMediaIntrinsicSize | null>(
    null
  );

  useEffect(() => {
    setAspectRatio(DEFAULT_DETAIL_ASPECT_RATIO);
    setNaturalSize(null);
  }, [mediaKey]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateBounds = (width: number, height: number) => {
      setBounds({ width, height });
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateBounds(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(element);
    const initialBounds = readStudioDetailContentBounds(element);
    updateBounds(initialBounds.width, initialBounds.height);

    return () => {
      observer.disconnect();
    };
  }, []);

  const displaySize = useMemo(
    () =>
      fitStudioDetailSize(
        bounds.width,
        bounds.height,
        aspectRatio,
        naturalSize?.width,
        naturalSize?.height
      ),
    [aspectRatio, bounds.height, bounds.width, naturalSize]
  );

  const applyPrimaryNaturalSize = (width: number, height: number) => {
    applyStudioDetailMediaNaturalSize(
      width,
      height,
      setAspectRatio,
      setNaturalSize
    );
  };

  return {
    containerRef,
    displaySize,
    applyPrimaryNaturalSize,
  };
}
