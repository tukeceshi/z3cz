import type { MediaReference } from "@dafthunk/types";
import { isMediaReference } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import ImageIcon from "lucide-react/icons/image";
import PlusIcon from "lucide-react/icons/plus";
import TypeIcon from "lucide-react/icons/type";
import VideoIcon from "lucide-react/icons/video";
import XIcon from "lucide-react/icons/x";
import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/components/locale-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReferenceThumbUrl } from "@/hooks/use-reference-thumb-url";
import { cn } from "@/utils/utils";

import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  classifyReferenceFromNodeType,
} from "./ai-text-node-utils";
import {
  collectGenerativeReferenceChips,
  type GenerativeReferenceChip,
} from "./generative-reference-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export type AiTextReferenceChip = GenerativeReferenceChip;

interface ReferenceHoverPreviewState {
  readonly chip: AiTextReferenceChip;
  readonly anchor: DOMRect;
}

const REFERENCE_HOVER_PREVIEW_GAP_PX = 8;
const REFERENCE_HOVER_PREVIEW_MAX_PX = 150;

function mediaNodeTypeForChip(
  chip: AiTextReferenceChip
): "ai-image" | "ai-video" | undefined {
  if (chip.kind === "image") return "ai-image";
  if (chip.kind === "video") return "ai-video";
  return undefined;
}

function chipMedia(chip: AiTextReferenceChip): MediaReference | null {
  return chip.media && isMediaReference(chip.media) ? chip.media : null;
}

function ReferenceChipMediaThumb({
  chip,
  fallbackIcon,
}: {
  readonly chip: AiTextReferenceChip;
  readonly fallbackIcon: ReactNode;
}) {
  const media = chipMedia(chip);
  const thumbUrl = useReferenceThumbUrl({
    media,
    nodeType: mediaNodeTypeForChip(chip),
  });

  const mediaContent =
    thumbUrl && (chip.kind === "image" || chip.kind === "video") ? (
      <img
        src={thumbUrl}
        alt={chip.label}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="text-muted-foreground">{fallbackIcon}</span>
    );

  return (
    <>
      {mediaContent}
      {chip.overlayLabel ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-px text-center text-[9px] font-medium leading-tight text-white">
          {chip.overlayLabel}
        </span>
      ) : null}
    </>
  );
}

function ReferenceHoverPreview({
  chip,
  anchor,
}: {
  readonly chip: AiTextReferenceChip;
  readonly anchor: DOMRect;
}) {
  const media = chipMedia(chip);
  const thumbUrl = useReferenceThumbUrl({
    media,
    nodeType: mediaNodeTypeForChip(chip),
  });

  const style = {
    left: anchor.left + anchor.width / 2,
    top: anchor.top - REFERENCE_HOVER_PREVIEW_GAP_PX,
    transform: "translate(-50%, -100%)",
  } as const;

  if ((chip.kind === "image" || chip.kind === "video") && thumbUrl) {
    return createPortal(
      <div
        className="pointer-events-none fixed z-[300] rounded-lg border border-border bg-popover p-1 shadow-lg"
        style={style}
      >
        <img
          src={thumbUrl}
          alt=""
          className="max-h-[150px] max-w-[150px] object-contain"
          style={{
            maxHeight: REFERENCE_HOVER_PREVIEW_MAX_PX,
            maxWidth: REFERENCE_HOVER_PREVIEW_MAX_PX,
          }}
        />
      </div>,
      document.body
    );
  }

  if (chip.kind === "text" && chip.textExcerpt) {
    return createPortal(
      <div
        className="pointer-events-none fixed z-[300] w-56 rounded-lg border border-border bg-popover p-2 shadow-lg"
        style={style}
      >
        <p className="line-clamp-6 text-xs leading-relaxed text-muted-foreground">
          {chip.textExcerpt}
        </p>
      </div>,
      document.body
    );
  }

  return null;
}

export function collectAiTextReferenceChips(params: {
  readonly nodeId: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}): readonly AiTextReferenceChip[] {
  return collectGenerativeReferenceChips({
    nodeId: params.nodeId,
    targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: classifyReferenceFromNodeType,
  });
}

export interface AiTextReferenceBarProps {
  readonly chips: readonly AiTextReferenceChip[];
  readonly disabled?: boolean;
  readonly allowUpload?: boolean;
  readonly addReferenceDisabled?: boolean;
  readonly canPickCanvasNode?: boolean;
  readonly onDisconnect: (edgeId: string) => void;
  readonly onPickCanvasNode: () => void;
  readonly onUploadFiles?: (files: FileList) => void;
  /** When omitted, chips are preview-only (AI Text). */
  readonly onInjectChip?: (chip: AiTextReferenceChip) => void;
}

export function AiTextReferenceBar({
  chips,
  disabled = false,
  allowUpload = false,
  addReferenceDisabled = false,
  canPickCanvasNode = true,
  onDisconnect,
  onPickCanvasNode,
  onUploadFiles,
  onInjectChip,
}: AiTextReferenceBarProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(
    null
  );
  const [hoverPreview, setHoverPreview] =
    useState<ReferenceHoverPreviewState | null>(null);

  const handleChipMouseEnter = (
    chip: AiTextReferenceChip,
    event: MouseEvent<HTMLDivElement>
  ) => {
    setHoverPreview({
      chip,
      anchor: event.currentTarget.getBoundingClientRect(),
    });
  };

  const handleChipMouseLeave = (chip: AiTextReferenceChip) => {
    setHoverPreview((current) =>
      current?.chip.edgeId === chip.edgeId ? null : current
    );
  };

  const iconForKind = useMemo(
    () => ({
      text: <TypeIcon className="h-4 w-4" />,
      image: <ImageIcon className="h-4 w-4" />,
      video: <VideoIcon className="h-4 w-4" />,
    }),
    []
  );

  const confirmDisconnect = () => {
    if (pendingDisconnectId) {
      onDisconnect(pendingDisconnectId);
    }
    setPendingDisconnectId(null);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <div
          key={chip.edgeId}
          className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background"
          onMouseEnter={(event) => handleChipMouseEnter(chip, event)}
          onMouseLeave={() => handleChipMouseLeave(chip)}
        >
          {onInjectChip ? (
            <button
              type="button"
              className="nodrag relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg"
              disabled={disabled}
              onClick={() => onInjectChip(chip)}
              title={chip.label}
            >
              <ReferenceChipMediaThumb
                chip={chip}
                fallbackIcon={iconForKind[chip.kind]}
              />
            </button>
          ) : (
            <div
              className="nodrag relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg"
              title={chip.label}
            >
              <ReferenceChipMediaThumb
                chip={chip}
                fallbackIcon={iconForKind[chip.kind]}
              />
            </div>
          )}
          {!disabled ? (
            <button
              type="button"
              className="nodrag absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-sm bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                setPendingDisconnectId(chip.edgeId);
              }}
              aria-label={t("workflow.aiTextPanel.disconnectReference")}
            >
              <XIcon className="h-2.5 w-2.5" />
            </button>
          ) : null}
        </div>
      ))}

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "nodrag flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed",
              "border-border text-muted-foreground transition hover:border-foreground/40 hover:text-foreground",
              disabled && "pointer-events-none opacity-50"
            )}
            disabled={disabled || addReferenceDisabled}
            title={t("workflow.aiTextPanel.addReference")}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            disabled={!canPickCanvasNode}
            onClick={() => {
              if (!canPickCanvasNode) return;
              setMenuOpen(false);
              onPickCanvasNode();
            }}
          >
            {t("workflow.aiTextPanel.pickCanvasNode")}
          </DropdownMenuItem>
          {allowUpload ? (
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                fileInputRef.current?.click();
              }}
            >
              {t("workflow.aiTextPanel.uploadLocal")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {allowUpload ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          multiple
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              onUploadFiles?.(event.target.files);
            }
            event.target.value = "";
          }}
        />
      ) : null}

      {hoverPreview ? (
        <ReferenceHoverPreview
          chip={hoverPreview.chip}
          anchor={hoverPreview.anchor}
        />
      ) : null}

      <AlertDialog
        open={pendingDisconnectId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnectId(null);
        }}
      >
        <AlertDialogContent
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            confirmDisconnect();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workflow.aiTextPanel.disconnectConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflow.aiTextPanel.disconnectConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction autoFocus onClick={confirmDisconnect}>
              {t("workflow.aiTextPanel.disconnectConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
