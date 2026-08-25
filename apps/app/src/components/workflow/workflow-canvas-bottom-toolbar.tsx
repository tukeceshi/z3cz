import Image from "lucide-react/icons/image";
import Maximize from "lucide-react/icons/maximize";
import Music from "lucide-react/icons/music";
import Network from "lucide-react/icons/network";
import Redo2 from "lucide-react/icons/redo-2";
import Type from "lucide-react/icons/type";
import Undo2 from "lucide-react/icons/undo-2";
import Video from "lucide-react/icons/video";
import {
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import {
  canvasDockBarClassName,
  canvasDockButtonClassName,
  canvasDockDividerClassName,
  canvasDockIconClassName,
} from "./canvas-chrome-styles";
import { CanvasShortcutHintButton } from "./canvas-shortcut-hint";
import { GENERATIVE_CANVAS_FILE_ACCEPT } from "./generative-card-upload-utils";

function DockDivider() {
  return <div className={canvasDockDividerClassName} aria-hidden />;
}

function DockButton({
  tooltip,
  disabled,
  onClick,
  children,
}: {
  readonly tooltip: ReactNode;
  readonly disabled?: boolean;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={canvasDockButtonClassName}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export interface WorkflowCanvasBottomToolbarProps {
  readonly disabled: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly onPickCanvasFiles?: (files: readonly File[]) => void;
  readonly onQuickAddAiNode?: (nodeType: "ai-image" | "ai-video" | "ai-audio") => void;
  readonly onApplyLayout?: () => void;
  readonly onFitToScreen?: (event: MouseEvent) => void;
  readonly onZoomOneToOne?: (event: MouseEvent) => void;
  readonly nodesEmpty: boolean;
  readonly shortcutHintCollapsed: boolean;
  readonly onToggleShortcutHint: (event: MouseEvent) => void;
  readonly keyboardRef: RefObject<HTMLDivElement | null>;
}

export function WorkflowCanvasBottomToolbar({
  disabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPickCanvasFiles,
  onQuickAddAiNode,
  onApplyLayout,
  onFitToScreen,
  onZoomOneToOne,
  nodesEmpty,
  shortcutHintCollapsed,
  onToggleShortcutHint,
  keyboardRef,
}: WorkflowCanvasBottomToolbarProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showOneToOne, setShowOneToOne] = useState(false);

  const handlePickFileClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? [...event.target.files] : [];
    event.target.value = "";
    if (files.length === 0) {
      return;
    }
    onPickCanvasFiles?.(files);
  };

  const handleFitToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (showOneToOne) {
      onZoomOneToOne?.(event);
      setShowOneToOne(false);
      return;
    }
    onFitToScreen?.(event);
    setShowOneToOne(true);
  };

  return (
    <div className={cn("relative flex flex-row items-center")}>
      {onPickCanvasFiles ? (
        <input
          ref={fileInputRef}
          id="workflow-canvas-pick-files"
          name="canvas_pick_files"
          type="file"
          className="hidden"
          multiple
          accept={GENERATIVE_CANVAS_FILE_ACCEPT}
          onChange={handleFileInputChange}
        />
      ) : null}

      <div className={cn("nodrag nopan nowheel", canvasDockBarClassName)}>
        <div className="flex items-center gap-1">
          <DockButton
            tooltip={t("workflow.canvas.undo")}
            disabled={disabled || !onUndo || !canUndo}
            onClick={(event) => {
              event.stopPropagation();
              onUndo?.();
            }}
          >
            <Undo2 className={canvasDockIconClassName} />
          </DockButton>
          <DockButton
            tooltip={t("workflow.canvas.redo")}
            disabled={disabled || !onRedo || !canRedo}
            onClick={(event) => {
              event.stopPropagation();
              onRedo?.();
            }}
          >
            <Redo2 className={canvasDockIconClassName} />
          </DockButton>
        </div>

        {!disabled && (onPickCanvasFiles || onQuickAddAiNode) ? (
          <>
            <DockDivider />
            <div className="flex items-center gap-1">
              {onPickCanvasFiles ? (
                <DockButton
                  tooltip={t("workflow.canvas.pickFile")}
                  onClick={handlePickFileClick}
                >
                  <Type className={canvasDockIconClassName} />
                </DockButton>
              ) : null}
              {onQuickAddAiNode ? (
                <>
                  <DockButton
                    tooltip={t("workflow.canvas.aiImage")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onQuickAddAiNode("ai-image");
                    }}
                  >
                    <Image className={canvasDockIconClassName} />
                  </DockButton>
                  <DockButton
                    tooltip={t("workflow.canvas.aiVideo")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onQuickAddAiNode("ai-video");
                    }}
                  >
                    <Video className={canvasDockIconClassName} />
                  </DockButton>
                  <DockButton
                    tooltip={t("workflow.canvas.aiAudio")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onQuickAddAiNode("ai-audio");
                    }}
                  >
                    <Music className={canvasDockIconClassName} />
                  </DockButton>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {!disabled && (onApplyLayout || onFitToScreen || onZoomOneToOne) ? (
          <>
            <DockDivider />
            <div className="flex items-center gap-1">
              {onApplyLayout ? (
                <DockButton
                  tooltip={t("workflow.canvas.reorganizeLayout")}
                  disabled={nodesEmpty}
                  onClick={(event) => {
                    event.stopPropagation();
                    onApplyLayout();
                  }}
                >
                  <Network className={canvasDockIconClassName} />
                </DockButton>
              ) : null}
              {onFitToScreen && onZoomOneToOne ? (
                <DockButton
                  tooltip={
                    showOneToOne
                      ? t("workflow.canvas.zoomOneToOne")
                      : t("workflow.canvas.fitToScreen")
                  }
                  onClick={handleFitToggle}
                >
                  {showOneToOne ? (
                    <span className="text-[11px] font-semibold leading-none tracking-tight">
                      1:1
                    </span>
                  ) : (
                    <Maximize className={canvasDockIconClassName} />
                  )}
                </DockButton>
              ) : null}
              <div ref={keyboardRef}>
                <CanvasShortcutHintButton
                  collapsed={shortcutHintCollapsed}
                  onToggle={onToggleShortcutHint}
                />
              </div>
            </div>
          </>
        ) : !disabled ? (
          <div ref={keyboardRef} className="flex items-center">
            <DockDivider />
            <CanvasShortcutHintButton
              collapsed={shortcutHintCollapsed}
              onToggle={onToggleShortcutHint}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
