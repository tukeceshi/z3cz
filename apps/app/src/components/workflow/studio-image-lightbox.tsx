import Maximize2Icon from "lucide-react/icons/maximize-2";
import ScanIcon from "lucide-react/icons/scan";
import ZoomInIcon from "lucide-react/icons/zoom-in";
import ZoomOutIcon from "lucide-react/icons/zoom-out";
import { PhotoProvider, PhotoView } from "react-photo-view";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import "react-photo-view/dist/react-photo-view.css";

const STUDIO_ZOOM_BUTTON_CLASSNAME =
  "nodrag nopan nowheel flex h-7 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/90 px-2 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur-sm transition hover:bg-muted dark:border-neutral-600 dark:bg-neutral-900/90 dark:hover:bg-neutral-800";

const PREVIEW_CLICK_DELAY_MS = 250;
const LONG_MODE_RATIO = 3;
const ONE_TO_ONE_PERCENT = 100;
const ONE_TO_ONE_TOLERANCE = 2;
const ZOOM_STEP_PERCENT = 10;
const MAX_ZOOM_PERCENT = 500;

const STUDIO_ZOOM_TOOLBAR_CLASSNAME =
  "pointer-events-auto flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-sm text-white backdrop-blur-sm";

const STUDIO_ZOOM_TOOLBAR_ICON_BUTTON_CLASSNAME =
  "nodrag nopan nowheel flex h-8 w-8 shrink-0 items-center justify-center rounded text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

const STUDIO_ZOOM_TOOLBAR_MODE_BUTTON_CLASSNAME =
  "nodrag nopan nowheel flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-white/35 px-2 text-xs font-semibold text-white transition hover:bg-white/10";

interface ImageNaturalSize {
  readonly width: number;
  readonly height: number;
}

interface StudioImageZoomMetricsContextValue {
  readonly naturalSize: ImageNaturalSize | null;
  readonly setNaturalSize: (size: ImageNaturalSize | null) => void;
}

const StudioImageZoomMetricsContext =
  createContext<StudioImageZoomMetricsContextValue | null>(null);

function useStudioImageZoomMetrics(): StudioImageZoomMetricsContextValue {
  const context = useContext(StudioImageZoomMetricsContext);
  if (!context) {
    throw new Error("StudioImagePhotoProvider is required");
  }
  return context;
}

/** Match react-photo-view fit logic so percent is relative to original pixels. */
function getSuitableFitSize(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { readonly width: number; readonly height: number } {
  const isVertical = viewportHeight > viewportWidth;
  let width = viewportWidth;
  let height = viewportHeight;
  const autoWidth = (naturalWidth / naturalHeight) * viewportHeight;
  const autoHeight = (naturalHeight / naturalWidth) * viewportWidth;

  if (naturalWidth < viewportWidth && naturalHeight < viewportHeight) {
    width = naturalWidth;
    height = naturalHeight;
  } else if (naturalWidth < viewportWidth && naturalHeight >= viewportHeight) {
    width = autoWidth;
  } else if (naturalWidth >= viewportWidth && naturalHeight < viewportHeight) {
    height = autoHeight;
  } else if (naturalWidth / naturalHeight > viewportWidth / viewportHeight) {
    height = autoHeight;
  } else if (naturalHeight / naturalWidth >= LONG_MODE_RATIO && !isVertical) {
    height = autoHeight;
  } else {
    width = autoWidth;
  }

  return { width, height };
}

function pluginScaleToImagePercent(
  pluginScale: number,
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const { width: fitWidth } = getSuitableFitSize(
    naturalWidth,
    naturalHeight,
    viewportWidth,
    viewportHeight
  );
  return Math.round(((fitWidth * pluginScale) / naturalWidth) * 100);
}

function imagePercentToPluginScale(
  imagePercent: number,
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const { width: fitWidth } = getSuitableFitSize(
    naturalWidth,
    naturalHeight,
    viewportWidth,
    viewportHeight
  );
  return (imagePercent / 100) * (naturalWidth / fitWidth);
}

function getAdaptiveImagePercent(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  return pluginScaleToImagePercent(
    1,
    naturalWidth,
    naturalHeight,
    viewportWidth,
    viewportHeight
  );
}

function isAtOneToOnePercent(displayPercent: number): boolean {
  return displayPercent >= ONE_TO_ONE_PERCENT - ONE_TO_ONE_TOLERANCE;
}

function StudioImageZoomToolbar({
  scale,
  onScale,
  visible,
}: {
  readonly scale: number;
  readonly onScale: (scale: number) => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const { naturalSize } = useStudioImageZoomMetrics();
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!visible) {
    return null;
  }

  const displayPercent =
    naturalSize != null
      ? pluginScaleToImagePercent(
          scale,
          naturalSize.width,
          naturalSize.height,
          viewportSize.width,
          viewportSize.height
        )
      : null;

  const adaptivePercent =
    naturalSize != null
      ? getAdaptiveImagePercent(
          naturalSize.width,
          naturalSize.height,
          viewportSize.width,
          viewportSize.height
        )
      : ONE_TO_ONE_PERCENT;

  const applyImagePercent = (targetPercent: number) => {
    if (naturalSize == null) {
      onScale(1);
      return;
    }
    const clampedPercent = Math.min(
      MAX_ZOOM_PERCENT,
      Math.max(adaptivePercent, targetPercent)
    );
    onScale(
      imagePercentToPluginScale(
        clampedPercent,
        naturalSize.width,
        naturalSize.height,
        viewportSize.width,
        viewportSize.height
      )
    );
  };

  const handleZoomOut = () => {
    if (displayPercent == null) return;
    applyImagePercent(displayPercent - ZOOM_STEP_PERCENT);
  };

  const handleZoomIn = () => {
    if (displayPercent == null) return;
    applyImagePercent(displayPercent + ZOOM_STEP_PERCENT);
  };

  const handleToggleDisplayMode = () => {
    if (displayPercent != null && isAtOneToOnePercent(displayPercent)) {
      onScale(1);
      return;
    }
    applyImagePercent(ONE_TO_ONE_PERCENT);
  };

  const atOneToOne =
    displayPercent != null && isAtOneToOnePercent(displayPercent);
  const zoomOutDisabled =
    displayPercent == null || displayPercent <= adaptivePercent;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[300] flex justify-center px-4">
      <div className={STUDIO_ZOOM_TOOLBAR_CLASSNAME}>
        <button
          type="button"
          className={STUDIO_ZOOM_TOOLBAR_ICON_BUTTON_CLASSNAME}
          title={t("workflow.studio.zoomOut")}
          disabled={zoomOutDisabled}
          onClick={(event) => {
            event.stopPropagation();
            handleZoomOut();
          }}
        >
          <ZoomOutIcon className="h-4 w-4" strokeWidth={2} />
        </button>
        <span className="min-w-12 px-1 text-center text-sm font-semibold tabular-nums text-white">
          {displayPercent == null ? "…" : `${displayPercent}%`}
        </span>
        <button
          type="button"
          className={STUDIO_ZOOM_TOOLBAR_ICON_BUTTON_CLASSNAME}
          title={t("workflow.studio.zoomIn")}
          disabled={displayPercent == null}
          onClick={(event) => {
            event.stopPropagation();
            handleZoomIn();
          }}
        >
          <ZoomInIcon className="h-4 w-4" strokeWidth={2} />
        </button>
        {atOneToOne ? (
          <button
            type="button"
            className={STUDIO_ZOOM_TOOLBAR_ICON_BUTTON_CLASSNAME}
            title={t("workflow.studio.zoomAdaptive")}
            onClick={(event) => {
              event.stopPropagation();
              handleToggleDisplayMode();
            }}
          >
            <ScanIcon className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            className={STUDIO_ZOOM_TOOLBAR_MODE_BUTTON_CLASSNAME}
            title={t("workflow.studio.zoomOneToOne")}
            onClick={(event) => {
              event.stopPropagation();
              handleToggleDisplayMode();
            }}
          >
            {t("workflow.studio.zoomOneToOne")}
          </button>
        )}
      </div>
    </div>
  );
}

function StudioImagePhotoProviderContent({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <PhotoProvider
      maskOpacity={0.88}
      toolbarRender={({ scale, onScale, visible }) => (
        <StudioImageZoomToolbar
          scale={scale}
          onScale={onScale}
          visible={visible}
        />
      )}
    >
      {children}
    </PhotoProvider>
  );
}

export function StudioImagePhotoProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [naturalSize, setNaturalSize] = useState<ImageNaturalSize | null>(null);

  return (
    <StudioImageZoomMetricsContext.Provider
      value={{ naturalSize, setNaturalSize }}
    >
      <StudioImagePhotoProviderContent>{children}</StudioImagePhotoProviderContent>
    </StudioImageZoomMetricsContext.Provider>
  );
}

export function useStudioImageZoomTrigger() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelZoom = useCallback(() => {
    if (clickTimerRef.current == null) return;
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  }, []);

  const scheduleZoom = useCallback(() => {
    cancelZoom();
    clickTimerRef.current = setTimeout(() => {
      triggerRef.current?.click();
      clickTimerRef.current = null;
    }, PREVIEW_CLICK_DELAY_MS);
  }, [cancelZoom]);

  useEffect(() => cancelZoom, [cancelZoom]);

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, enabled: boolean) => {
      if (!enabled) return;
      event.stopPropagation();
      scheduleZoom();
    },
    [scheduleZoom]
  );

  const handlePreviewDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      cancelZoom();
      event.stopPropagation();
    },
    [cancelZoom]
  );

  return {
    triggerRef,
    handlePreviewClick,
    handlePreviewDoubleClick,
  };
}

export function StudioImageZoomHiddenTrigger({
  src,
  triggerRef,
}: {
  readonly src: string;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const { setNaturalSize } = useStudioImageZoomMetrics();

  useEffect(() => {
    setNaturalSize(null);
    const image = new Image();
    image.onload = () => {
      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      setNaturalSize(null);
    };
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [setNaturalSize, src]);

  return (
    <PhotoView src={src}>
      <button
        ref={triggerRef}
        type="button"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </PhotoView>
  );
}

export function StudioImageZoomToolbarButton({
  onOpen,
}: {
  readonly onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={STUDIO_ZOOM_BUTTON_CLASSNAME}
      title={t("workflow.studio.viewImage")}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <Maximize2Icon className="h-3 w-3 opacity-80" strokeWidth={2} />
      <span>{t("workflow.studio.viewImage")}</span>
    </button>
  );
}

export function studioImagePreviewZoomClassName(enabled: boolean): string {
  return cn(enabled && "cursor-zoom-in");
}
