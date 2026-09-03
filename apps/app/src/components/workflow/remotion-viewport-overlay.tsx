import { Player } from "@remotion/player";
import ChevronDown from "lucide-react/icons/chevron-down";
import ChevronUp from "lucide-react/icons/chevron-up";
import Clapperboard from "lucide-react/icons/clapperboard";
import X from "lucide-react/icons/x";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { CodeEditor } from "@/components/ui/code-editor";
import { Spinner } from "@/components/ui/spinner";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import {
  compileRemotionSource,
  renderRemotionCompileError,
} from "@/services/remotion-live-compile";
import {
  DEFAULT_REMOTION_SOURCE_CODE,
  readRemotionViewportContent,
  writeRemotionViewportContent,
} from "@/services/remotion-viewport-staging";
import { cn } from "@/utils/utils";

const PANEL_WIDTH_CLASS = "w-[20vw] min-w-[400px]";
const PANEL_HEIGHT_CLASS = "h-[calc(100dvh-3.5rem-1rem)]";
const COMPACT_PREVIEW_HEIGHT_PX = 225;
const COMPOSITION_WIDTH = 1280;
const COMPOSITION_HEIGHT = 720;
const COMPOSITION_FPS = 30;
const COMPOSITION_DURATION_FRAMES = 90;
const SOURCE_SAVE_DELAY_MS = 400;
const COMPILE_DELAY_MS = 400;

type LoadPhase = "loading" | "ready";

export interface RemotionViewportOverlayProps {
  readonly organizationId?: string;
  readonly workflowId?: string;
  readonly workflowName?: string;
  readonly visible?: boolean;
  readonly onClose: () => void;
}

function deferPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function RemotionViewportOverlay({
  organizationId,
  workflowId,
  workflowName = "",
  visible = true,
  onClose,
}: RemotionViewportOverlayProps) {
  const { t } = useTranslation();
  const sourceSaveTimerRef = useRef<number | null>(null);
  const compileTimerRef = useRef<number | null>(null);
  const initialLoadDoneRef = useRef(false);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("loading");
  const [sourceCode, setSourceCode] = useState(DEFAULT_REMOTION_SOURCE_CODE);
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiledComponent, setCompiledComponent] = useState<ComponentType>(
    () => () => null
  );
  const [playerKey, setPlayerKey] = useState(0);

  const canPersist = Boolean(organizationId && workflowId);

  const persistSourceCode = useCallback(
    (nextSourceCode: string) => {
      if (!organizationId || !workflowId) {
        return;
      }
      void writeRemotionViewportContent({
        organizationId,
        workflowId,
        workflowName: workflowName || workflowId,
        content: { sourceCode: nextSourceCode },
      });
    },
    [organizationId, workflowId, workflowName]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await deferPaint();
      if (cancelled) {
        return;
      }

      let nextSource = DEFAULT_REMOTION_SOURCE_CODE;
      if (organizationId && workflowId) {
        const content = await readRemotionViewportContent({
          organizationId,
          workflowId,
        });
        nextSource = content.sourceCode;
      }

      if (cancelled) {
        return;
      }

      setSourceCode(nextSource);
      const result = compileRemotionSource(nextSource);
      if (result.error) {
        setCompileError(result.error);
        setCompiledComponent(
          () => () => renderRemotionCompileError(result.error ?? "")
        );
      } else {
        setCompileError(null);
        setCompiledComponent(() => result.component);
        setPlayerKey((key) => key + 1);
      }
      initialLoadDoneRef.current = true;
      setLoadPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, workflowId]);

  useEffect(() => {
    if (!organizationId || !workflowId) {
      return;
    }
    const handleCacheChanged = () => {
      if (!initialLoadDoneRef.current || sourceSaveTimerRef.current !== null) {
        return;
      }
      void readRemotionViewportContent({ organizationId, workflowId }).then(
        (content) => {
          setSourceCode((current) =>
            current === content.sourceCode ? current : content.sourceCode
          );
        }
      );
    };
    window.addEventListener(CACHE_STATS_EVENT, handleCacheChanged);
    return () => {
      window.removeEventListener(CACHE_STATS_EVENT, handleCacheChanged);
    };
  }, [organizationId, workflowId]);

  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      return;
    }

    if (compileTimerRef.current !== null) {
      window.clearTimeout(compileTimerRef.current);
    }
    compileTimerRef.current = window.setTimeout(() => {
      const result = compileRemotionSource(sourceCode);
      if (result.error) {
        setCompileError(result.error);
        return;
      }
      setCompileError(null);
      setCompiledComponent(() => result.component);
      setPlayerKey((key) => key + 1);
    }, COMPILE_DELAY_MS);

    return () => {
      if (compileTimerRef.current !== null) {
        window.clearTimeout(compileTimerRef.current);
      }
    };
  }, [sourceCode]);

  useEffect(() => {
    return () => {
      if (sourceSaveTimerRef.current !== null) {
        window.clearTimeout(sourceSaveTimerRef.current);
      }
    };
  }, []);

  const handleSourceChange = (value: string) => {
    setSourceCode(value);
    if (!canPersist) {
      return;
    }
    if (sourceSaveTimerRef.current !== null) {
      window.clearTimeout(sourceSaveTimerRef.current);
    }
    sourceSaveTimerRef.current = window.setTimeout(() => {
      persistSourceCode(value);
    }, SOURCE_SAVE_DELAY_MS);
  };

  const errorOverlay = useMemo(() => {
    if (!compileError || loadPhase !== "ready") {
      return null;
    }
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-3">
        <p className="text-center font-mono text-xs leading-relaxed text-red-300">
          {compileError}
        </p>
      </div>
    );
  }, [compileError, loadPhase]);

  const previewArea = (
    <div
      className="relative shrink-0 bg-black"
      style={{ height: COMPACT_PREVIEW_HEIGHT_PX }}
    >
      {loadPhase === "loading" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-400">
          <Spinner className="size-6 text-neutral-400" />
          <span className="text-[11px]">
            {t("workflow.canvas.remotionViewportLoading")}
          </span>
        </div>
      ) : (
        <>
          <Player
            key={playerKey}
            component={compiledComponent}
            compositionWidth={COMPOSITION_WIDTH}
            compositionHeight={COMPOSITION_HEIGHT}
            durationInFrames={COMPOSITION_DURATION_FRAMES}
            fps={COMPOSITION_FPS}
            inputProps={{}}
            style={{ width: "100%", height: "100%" }}
            controls
            autoPlay={false}
            loop
            clickToPlay
            acknowledgeRemotionLicense
          />
          {errorOverlay}
        </>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "nodrag nopan nowheel flex shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900",
        PANEL_WIDTH_CLASS,
        codeExpanded ? PANEL_HEIGHT_CLASS : "h-auto",
        !visible && "hidden"
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t("workflow.canvas.remotionViewportTitle")}
      aria-hidden={!visible}
    >
      <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
        <Clapperboard className="size-3.5 shrink-0 text-neutral-500" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {t("workflow.canvas.remotionViewportTitle")}
        </span>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          onClick={onClose}
          aria-label={t("workflow.canvas.remotionViewportClose")}
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-col",
          codeExpanded ? "min-h-0 flex-1" : undefined
        )}
      >
        {previewArea}

        {codeExpanded ? (
          <div className="flex min-h-0 flex-1 flex-col border-t border-neutral-200 dark:border-neutral-700">
            <CodeEditor
              value={sourceCode}
              onChange={handleSourceChange}
              language="javascript"
              scrollerClassName="thin-scrollbar"
              className="min-h-0 flex-1"
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="flex w-full shrink-0 items-center justify-center gap-1 border-t border-neutral-200 py-1.5 text-[11px] text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800/60"
        onClick={() => setCodeExpanded((expanded) => !expanded)}
        aria-expanded={codeExpanded}
        aria-label={
          codeExpanded
            ? t("workflow.canvas.remotionViewportCollapseCode")
            : t("workflow.canvas.remotionViewportExpandCode")
        }
      >
        {codeExpanded ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
        <span>
          {codeExpanded
            ? t("workflow.canvas.remotionViewportCollapseCode")
            : t("workflow.canvas.remotionViewportExpandCode")}
        </span>
      </button>
    </div>
  );
}
