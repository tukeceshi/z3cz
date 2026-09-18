import {
  VIDEO_SUBTITLE_ERASE_MAX_REGIONS,
  VIDEO_SUBTITLE_ERASE_MIN_REGION_AREA,
  clampVideoSubtitleEraseRect,
  type VideoSubtitleEraseRect,
} from "@dafthunk/types";
import XIcon from "lucide-react/icons/x";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useTranslation } from "@/components/locale-provider";

import { useSubtitleEraseSession } from "./video-subtitle-erase-session-context";

type EraseHandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type EraseInteraction =
  | {
      readonly kind: "create";
      readonly start: { readonly x: number; readonly y: number };
    }
  | {
      readonly kind: "move";
      readonly index: number;
      readonly originRect: VideoSubtitleEraseRect;
      readonly start: { readonly x: number; readonly y: number };
    }
  | {
      readonly kind: "resize";
      readonly index: number;
      readonly handle: EraseHandleId;
      readonly originRect: VideoSubtitleEraseRect;
    };

const MIN_REGION_EDGE = 0.01;

function rectToStyle(rect: VideoSubtitleEraseRect): CSSProperties {
  return {
    left: `${rect.topLeftX * 100}%`,
    top: `${rect.topLeftY * 100}%`,
    width: `${(rect.bottomRightX - rect.topLeftX) * 100}%`,
    height: `${(rect.bottomRightY - rect.topLeftY) * 100}%`,
  };
}

function rectArea(rect: VideoSubtitleEraseRect): number {
  return (
    (rect.bottomRightX - rect.topLeftX) * (rect.bottomRightY - rect.topLeftY)
  );
}

const HANDLE_CURSOR: Readonly<Record<EraseHandleId, string>> = {
  nw: "cursor-nw-resize",
  n: "cursor-ns-resize",
  ne: "cursor-ne-resize",
  e: "cursor-ew-resize",
  se: "cursor-se-resize",
  s: "cursor-ns-resize",
  sw: "cursor-sw-resize",
  w: "cursor-ew-resize",
};

const BOX_CLASS =
  "absolute cursor-grab border-[1.5px] border-primary bg-primary/15";

const EDGE_HANDLE_STYLES: readonly {
  readonly id: EraseHandleId;
  readonly style: CSSProperties;
}[] = [
  { id: "n", style: { left: 0, right: 0, top: -5, height: 10 } },
  { id: "s", style: { left: 0, right: 0, bottom: -5, height: 10 } },
  { id: "w", style: { top: 0, bottom: 0, left: -5, width: 10 } },
  { id: "e", style: { top: 0, bottom: 0, right: -5, width: 10 } },
];

const CORNER_HANDLE_STYLES: readonly {
  readonly id: EraseHandleId;
  readonly style: CSSProperties;
}[] = [
  { id: "nw", style: { left: -3, top: -3 } },
  { id: "ne", style: { right: -3, top: -3 } },
  { id: "se", style: { right: -3, bottom: -3 } },
  { id: "sw", style: { left: -3, bottom: -3 } },
];

function resizeRect(
  origin: VideoSubtitleEraseRect,
  handle: EraseHandleId,
  point: { readonly x: number; readonly y: number }
): VideoSubtitleEraseRect {
  let left = origin.topLeftX;
  let top = origin.topLeftY;
  let right = origin.bottomRightX;
  let bottom = origin.bottomRightY;
  if (handle.includes("w")) left = point.x;
  if (handle.includes("e")) right = point.x;
  if (handle.includes("n")) top = point.y;
  if (handle.includes("s")) bottom = point.y;
  if (right - left < MIN_REGION_EDGE) {
    if (handle.includes("w")) left = right - MIN_REGION_EDGE;
    else right = left + MIN_REGION_EDGE;
  }
  if (bottom - top < MIN_REGION_EDGE) {
    if (handle.includes("n")) top = bottom - MIN_REGION_EDGE;
    else bottom = top + MIN_REGION_EDGE;
  }
  return clampVideoSubtitleEraseRect({
    topLeftX: left,
    topLeftY: top,
    bottomRightX: right,
    bottomRightY: bottom,
  });
}

export function SubtitleEraseRegionOverlay() {
  const { t } = useTranslation();
  const { session, setRegions } = useSubtitleEraseSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<EraseInteraction | null>(null);
  const [draft, setDraft] = useState<VideoSubtitleEraseRect | null>(null);

  const regions = session?.regions ?? [];

  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !session) {
        return;
      }
      const target = event.target as HTMLElement;
      const boxElement = target.closest<HTMLElement>("[data-box-index]");
      const handleId = target.dataset.handle as EraseHandleId | undefined;
      const point = toNormalized(event.clientX, event.clientY);

      if (boxElement && handleId) {
        const index = Number(boxElement.dataset.boxIndex);
        const originRect = regions[index];
        if (!originRect) {
          return;
        }
        interactionRef.current = {
          kind: "resize",
          index,
          handle: handleId,
          originRect,
        };
        event.preventDefault();
        return;
      }

      if (boxElement) {
        const index = Number(boxElement.dataset.boxIndex);
        const originRect = regions[index];
        if (!originRect) {
          return;
        }
        interactionRef.current = {
          kind: "move",
          index,
          originRect,
          start: point,
        };
        event.preventDefault();
        return;
      }

      if (regions.length >= VIDEO_SUBTITLE_ERASE_MAX_REGIONS) {
        return;
      }
      interactionRef.current = { kind: "create", start: point };
      setDraft(
        clampVideoSubtitleEraseRect({
          topLeftX: point.x,
          topLeftY: point.y,
          bottomRightX: point.x,
          bottomRightY: point.y,
        })
      );
      event.preventDefault();
    },
    [regions, session, toNormalized]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }
      const point = toNormalized(event.clientX, event.clientY);
      if (interaction.kind === "create") {
        setDraft(
          clampVideoSubtitleEraseRect({
            topLeftX: interaction.start.x,
            topLeftY: interaction.start.y,
            bottomRightX: point.x,
            bottomRightY: point.y,
          })
        );
        return;
      }

      let next: VideoSubtitleEraseRect;
      if (interaction.kind === "move") {
        const dx = point.x - interaction.start.x;
        const dy = point.y - interaction.start.y;
        const width =
          interaction.originRect.bottomRightX - interaction.originRect.topLeftX;
        const height =
          interaction.originRect.bottomRightY - interaction.originRect.topLeftY;
        const left = Math.min(
          1 - width,
          Math.max(0, interaction.originRect.topLeftX + dx)
        );
        const top = Math.min(
          1 - height,
          Math.max(0, interaction.originRect.topLeftY + dy)
        );
        next = clampVideoSubtitleEraseRect({
          topLeftX: left,
          topLeftY: top,
          bottomRightX: left + width,
          bottomRightY: top + height,
        });
      } else {
        next = resizeRect(interaction.originRect, interaction.handle, point);
      }

      const rects = [...regions];
      rects[interaction.index] = next;
      setRegions(rects);
    },
    [regions, setRegions, toNormalized]
  );

  const handlePointerUp = useCallback(() => {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    if (!interaction || interaction.kind !== "create") {
      return;
    }
    setDraft((current) => {
      if (
        current &&
        rectArea(current) >= VIDEO_SUBTITLE_ERASE_MIN_REGION_AREA &&
        regions.length < VIDEO_SUBTITLE_ERASE_MAX_REGIONS
      ) {
        setRegions([...regions, current]);
      }
      return null;
    });
  }, [regions, setRegions]);

  const handleDeleteBox = useCallback(
    (index: number) => {
      setRegions(regions.filter((_, i) => i !== index));
    },
    [regions, setRegions]
  );

  if (!session?.regionMode) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 cursor-crosshair touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {regions.map((rect, index) => (
        <div
          key={index}
          data-box-index={index}
          className={BOX_CLASS}
          style={rectToStyle(rect)}
        >
          <button
            type="button"
            aria-label={t("workflow.subtitleErase.regionDelete")}
            className="absolute -right-2 -top-2 z-[3] flex size-4 items-center justify-center rounded-full bg-neutral-800 text-neutral-50 shadow-sm transition hover:bg-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteBox(index);
            }}
          >
            <XIcon className="size-2.5" strokeWidth={2.5} />
          </button>
          {EDGE_HANDLE_STYLES.map(({ id, style }) => (
            <div
              key={id}
              data-handle={id}
              className={`absolute z-[1] ${HANDLE_CURSOR[id]}`}
              style={style}
            />
          ))}
          {CORNER_HANDLE_STYLES.map(({ id, style }) => (
            <div
              key={id}
              data-handle={id}
              className={`absolute z-[2] size-1.5 bg-primary ${HANDLE_CURSOR[id]}`}
              style={style}
            />
          ))}
        </div>
      ))}

      {draft ? (
        <div
          className="pointer-events-none absolute border-[1.5px] border-dashed border-primary bg-primary/15"
          style={rectToStyle(draft)}
        />
      ) : null}
    </div>
  );
}
