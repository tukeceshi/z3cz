import {
  clampVideoEnhanceFps,
  listHigherVideoEnhanceResolutions,
  VIDEO_ENHANCE_DEFAULT_SOURCE_TIER,
  VIDEO_ENHANCE_FPS_DEFAULT,
  VIDEO_ENHANCE_FPS_MARKS,
  VIDEO_ENHANCE_FPS_MAX,
  VIDEO_ENHANCE_FPS_MIN,
  type VideoEnhanceNodeConfig,
  VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODE_LABEL_KEYS,
  type VolcanoMediaKitPricingResolution,
  type VolcanoMediaKitVideoEnhanceMode,
} from "@dafthunk/types";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDismissOnCanvasPointerDown } from "@/hooks/use-dismiss-on-canvas-pointer-down";
import { cn } from "@/utils/utils";
import { DurationDragSlider } from "./duration-drag-slider";

interface AiVideoEnhanceSettingsPanelProps {
  readonly enabledModes: readonly VolcanoMediaKitVideoEnhanceMode[];
  readonly sourceTier?: VolcanoMediaKitPricingResolution;
  readonly value: VideoEnhanceNodeConfig;
  readonly disabled?: boolean;
  readonly onChange: (next: VideoEnhanceNodeConfig) => void;
}

const SELECT_TRIGGER_CLASS =
  "h-7 w-auto min-w-[6.5rem] max-w-[10rem] border-0 bg-muted/40 px-2 text-xs shadow-none focus:ring-0";

const FPS_INPUT_CLASS = cn(
  "h-5 w-9 rounded-md border-0 bg-muted/45 px-1 py-0.5 text-center text-xs tabular-nums shadow-none outline-none",
  "focus-visible:border-0 focus-visible:bg-muted/65",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);

type OpenEnhanceSelect = "mode" | "resolution" | null;

function ParamRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

export function createDefaultVideoEnhanceConfig(
  enabledModes: readonly VolcanoMediaKitVideoEnhanceMode[],
  sourceTier: VolcanoMediaKitPricingResolution = VIDEO_ENHANCE_DEFAULT_SOURCE_TIER
): VideoEnhanceNodeConfig | null {
  const mode = enabledModes[0];
  if (!mode) {
    return null;
  }

  const resolutions = listHigherVideoEnhanceResolutions(sourceTier);
  const resolution = resolutions[0] ?? "1080P";

  return {
    mode,
    resolution,
    fps: VIDEO_ENHANCE_FPS_DEFAULT,
  };
}

export function AiVideoEnhanceSettingsPanel({
  enabledModes,
  sourceTier = VIDEO_ENHANCE_DEFAULT_SOURCE_TIER,
  value,
  disabled = false,
  onChange,
}: AiVideoEnhanceSettingsPanelProps) {
  const { t } = useTranslation();
  const [fpsPreview, setFpsPreview] = useState(value.fps);
  const [fpsInputDraft, setFpsInputDraft] = useState<string | null>(null);
  const [openSelect, setOpenSelect] = useState<OpenEnhanceSelect>(null);
  const isDraggingFpsRef = useRef(false);
  const isFpsInputFocusedRef = useRef(false);

  useDismissOnCanvasPointerDown(openSelect !== null, () => {
    setOpenSelect(null);
  });

  useEffect(() => {
    if (!isDraggingFpsRef.current && !isFpsInputFocusedRef.current) {
      setFpsPreview(value.fps);
    }
  }, [value.fps]);

  const commitFps = useCallback(
    (next: number) => {
      const fps = clampVideoEnhanceFps(next);
      setFpsPreview(fps);
      onChange({ ...value, fps });
    },
    [onChange, value]
  );

  const handleFpsInputCommit = useCallback(
    (raw: string) => {
      isFpsInputFocusedRef.current = false;
      setFpsInputDraft(null);
      if (raw.trim() === "") {
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return;
      }
      commitFps(parsed);
    },
    [commitFps]
  );

  const resolutionOptions = useMemo(
    (): readonly VolcanoMediaKitPricingResolution[] =>
      listHigherVideoEnhanceResolutions(sourceTier),
    [sourceTier]
  );

  useEffect(() => {
    if (
      resolutionOptions.length > 0 &&
      !resolutionOptions.includes(value.resolution)
    ) {
      onChange({ ...value, resolution: resolutionOptions[0]! });
    }
  }, [onChange, resolutionOptions, value]);

  return (
    <div className="px-3 pt-3">
      <p className="text-sm font-medium text-foreground">
        {t("workflow.videoEnhance.action")}
      </p>

      <ParamRow label={t("workflow.videoEnhance.mode")}>
        <Select
          value={value.mode}
          open={openSelect === "mode"}
          disabled={disabled}
          onOpenChange={(nextOpen) => {
            setOpenSelect(nextOpen ? "mode" : null);
          }}
          onValueChange={(mode) =>
            onChange({
              ...value,
              mode: mode as VolcanoMediaKitVideoEnhanceMode,
            })
          }
        >
          <SelectTrigger className={SELECT_TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enabledModes.map((mode) => (
              <SelectItem key={mode} value={mode} className="text-xs">
                {t(VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODE_LABEL_KEYS[mode])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ParamRow>

      <ParamRow label={t("workflow.videoEnhance.resolution")}>
        {resolutionOptions.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("workflow.videoEnhance.noHigherResolution")}
          </span>
        ) : (
          <Select
            value={value.resolution}
            open={openSelect === "resolution"}
            disabled={disabled}
            onOpenChange={(nextOpen) => {
              setOpenSelect(nextOpen ? "resolution" : null);
            }}
            onValueChange={(resolution) =>
              onChange({
                ...value,
                resolution: resolution as VolcanoMediaKitPricingResolution,
              })
            }
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resolutionOptions.map((resolution) => (
                <SelectItem
                  key={resolution}
                  value={resolution}
                  className="text-xs"
                >
                  {resolution}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ParamRow>

      <ParamRow label={t("workflow.videoEnhance.fps")}>
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <DurationDragSlider
            min={VIDEO_ENHANCE_FPS_MIN}
            max={VIDEO_ENHANCE_FPS_MAX}
            value={fpsPreview}
            disabled={disabled}
            marks={VIDEO_ENHANCE_FPS_MARKS}
            onDragStart={() => {
              isDraggingFpsRef.current = true;
              setFpsInputDraft(null);
            }}
            onPreview={setFpsPreview}
            onCommit={(next) => {
              isDraggingFpsRef.current = false;
              commitFps(next);
            }}
          />
          <Input
            type="text"
            inputMode="numeric"
            name="video_enhance_fps"
            autoComplete="off"
            value={fpsInputDraft ?? String(fpsPreview)}
            disabled={disabled}
            className={cn(
              "nodrag nopan nowheel mt-0 shrink-0",
              FPS_INPUT_CLASS
            )}
            onFocus={() => {
              isFpsInputFocusedRef.current = true;
              setFpsInputDraft(String(fpsPreview));
            }}
            onChange={(event) => setFpsInputDraft(event.target.value)}
            onBlur={(event) => handleFpsInputCommit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </ParamRow>
    </div>
  );
}
