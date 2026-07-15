import type { ObjectReference } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import ImageIcon from "lucide-react/icons/image";
import PlusIcon from "lucide-react/icons/plus";
import TypeIcon from "lucide-react/icons/type";
import VideoIcon from "lucide-react/icons/video";
import XIcon from "lucide-react/icons/x";
import { useMemo, useRef, useState } from "react";

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
import { cn } from "@/utils/utils";

import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  classifyReferenceFromNodeType,
  type AiTextReferenceKind,
} from "./ai-text-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface AiTextReferenceChip {
  readonly edgeId: string;
  readonly kind: AiTextReferenceKind;
  readonly label: string;
  readonly previewUrl?: string;
  readonly textExcerpt?: string;
}

function firstObjectReference(value: unknown): ObjectReference | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && "id" in first) {
      return first as ObjectReference;
    }
    return null;
  }
  if ("id" in value) return value as ObjectReference;
  return null;
}

export function collectAiTextReferenceChips(params: {
  readonly nodeId: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
}): readonly AiTextReferenceChip[] {
  return params.edges
    .filter(
      (edge) =>
        edge.target === params.nodeId &&
        edge.targetHandle === AI_TEXT_KEYWORDS_HANDLE_ID
    )
    .flatMap((edge) => {
      const source = params.nodes.find((node) => node.id === edge.source);
      if (!source) return [];
      const sourceData = source.data as WorkflowNodeType;
      const kind = classifyReferenceFromNodeType(sourceData.nodeType);
      if (!kind) return [];

      const output = sourceData.outputs?.find(
        (entry) => entry.id === edge.sourceHandle
      );

      let previewUrl: string | undefined;
      let textExcerpt: string | undefined;

      if (kind === "text") {
        const fromOutput =
          typeof output?.value === "string" ? output.value : undefined;
        const fromResult = sourceData.inputs?.find(
          (entry) => entry.id === "result"
        )?.value;
        const text =
          fromOutput ??
          (typeof fromResult === "string" ? fromResult : undefined);
        textExcerpt = text?.trim() || undefined;
      } else {
        const ref = firstObjectReference(output?.value);
        if (ref && params.createObjectUrl) {
          previewUrl = params.createObjectUrl(ref);
        }
      }

      return [
        {
          edgeId: edge.id,
          kind,
          label: sourceData.name || edge.source,
          previewUrl,
          textExcerpt,
        },
      ];
    });
}

export interface AiTextReferenceBarProps {
  readonly chips: readonly AiTextReferenceChip[];
  readonly disabled?: boolean;
  readonly allowUpload?: boolean;
  readonly onDisconnect: (edgeId: string) => void;
  readonly onPickCanvasNode: () => void;
  readonly onUploadFiles: (files: FileList) => void;
  readonly onInjectChip: (chip: AiTextReferenceChip) => void;
}

export function AiTextReferenceBar({
  chips,
  disabled = false,
  allowUpload = false,
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
  const [hoverChipId, setHoverChipId] = useState<string | null>(null);

  const iconForKind = useMemo(
    () => ({
      text: <TypeIcon className="h-4 w-4" />,
      image: <ImageIcon className="h-4 w-4" />,
      video: <VideoIcon className="h-4 w-4" />,
    }),
    []
  );

  const hoverChip = chips.find((chip) => chip.edgeId === hoverChipId);

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <div
          key={chip.edgeId}
          className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background"
          onMouseEnter={() => setHoverChipId(chip.edgeId)}
          onMouseLeave={() =>
            setHoverChipId((current) =>
              current === chip.edgeId ? null : current
            )
          }
        >
          <button
            type="button"
            className="nodrag flex h-full w-full items-center justify-center"
            disabled={disabled}
            onClick={() => onInjectChip(chip)}
            title={chip.label}
          >
            {chip.previewUrl && chip.kind === "image" ? (
              <img
                src={chip.previewUrl}
                alt={chip.label}
                className="h-full w-full object-cover"
              />
            ) : chip.previewUrl && chip.kind === "video" ? (
              <video
                src={chip.previewUrl}
                className="h-full w-full object-cover"
                muted
              />
            ) : (
              <span className="text-muted-foreground">
                {iconForKind[chip.kind]}
              </span>
            )}
          </button>
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
            disabled={disabled}
            title={t("workflow.aiTextPanel.addReference")}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            onClick={() => {
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
              onUploadFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
      ) : null}

      {hoverChip ? (
        <div className="pointer-events-none absolute left-0 top-12 z-50 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <p className="mb-1 truncate text-[11px] font-medium text-foreground">
            {hoverChip.label}
          </p>
          {hoverChip.kind === "image" && hoverChip.previewUrl ? (
            <img
              src={hoverChip.previewUrl}
              alt={hoverChip.label}
              className="max-h-36 w-full rounded object-cover"
            />
          ) : hoverChip.kind === "video" && hoverChip.previewUrl ? (
            <video
              src={hoverChip.previewUrl}
              className="max-h-36 w-full rounded object-cover"
              muted
              autoPlay
              loop
            />
          ) : (
            <p className="line-clamp-6 text-xs leading-relaxed text-muted-foreground">
              {hoverChip.textExcerpt ||
                t("workflow.aiTextPanel.historyEmptyItem")}
            </p>
          )}
        </div>
      ) : null}

      <AlertDialog
        open={pendingDisconnectId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnectId(null);
        }}
      >
        <AlertDialogContent>
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
            <AlertDialogAction
              onClick={() => {
                if (pendingDisconnectId) {
                  onDisconnect(pendingDisconnectId);
                }
                setPendingDisconnectId(null);
              }}
            >
              {t("workflow.aiTextPanel.disconnectConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
