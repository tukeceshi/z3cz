import {
  AI_IMAGE_NODE_TYPE,
  getMediaReferenceKey,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useObjectService } from "@/services/object-service";
import { cn } from "@/utils/utils";

import {
  AiImageExpandButton,
  AiImageExpandOverlay,
} from "../../ai-image-expand-overlay";
import {
  AiImageHistoryButton,
  AiImageHistoryOverlay,
} from "../../ai-image-history-overlay";
import {
  AI_IMAGE_CARD_HEIGHT_PX,
  AI_IMAGE_CARD_WIDTH_PX,
  isAiImageGenerating,
  readAiImageCardImages,
  readAiImageResultHistory,
  withAiImageHistorySelection,
  withAiImageManualUpload,
} from "../../ai-image-node-utils";
import {
  shouldShowGenerativeHistoryIcon,
  withGenerativeCardEditing,
} from "../../generative-card-mode-utils";
import {
  readGenerativePrompt,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
import { useGenerativeCardDoubleClickUpload } from "../../use-generative-card-double-click-upload";
import { MediaImageField } from "../../fields/media-image-field";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiImageWidgetProps extends BaseWidgetProps {
  images: MediaReference[];
  historyItems: ReturnType<typeof readAiImageResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiImageWidget({
  images,
  historyItems,
  disabled = false,
  className,
  nodeId,
  prompt,
  metadata,
  createObjectUrl,
}: AiImageWidgetProps) {
  const { t } = useTranslation();
  const { updateNodeData } = useWorkflow();
  const { uploadBinaryData } = useObjectService();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const cardPlaceholder = t("workflow.aiImagePanel.cardUploadPlaceholder");

  const handleClearPrompt = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      inputs: withGenerativePromptCleared(current.inputs),
    }));
  }, [nodeId, updateNodeData]);

  const { handleCardDoubleClick, uploadConfirmDialog } =
    useGenerativeCardDoubleClickUpload({
      prompt,
      hasMedia: images.length > 0,
      isGenerating: isAiImageGenerating(metadata),
      disabled,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiImagePanel",
    });

  const setCardEditing = useCallback(
    (editing: boolean) => {
      if (!updateNodeData) return;
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeCardEditing(current.metadata, editing),
      }));
    },
    [nodeId, updateNodeData]
  );

  useEffect(() => {
    return () => {
      setCardEditing(false);
    };
  }, [setCardEditing]);

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      const item = historyItems.items.find((entry) => entry.id === id);
      if (!item) return;

      updateNodeData(nodeId, (current) =>
        withAiImageHistorySelection(current, id)
      );
    },
    [disabled, historyItems.items, nodeId, updateNodeData]
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || !files?.length || !updateNodeData) return;

      const file = files[0];
      if (!file.type.startsWith("image/")) {
        return;
      }

      setUploading(true);
      setCardEditing(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const mimeType = file.type || "application/octet-stream";
        const value = (await uploadBinaryData(
          arrayBuffer,
          mimeType
        )) as ObjectReference;

        updateNodeData(nodeId, (current) =>
          withAiImageManualUpload(current, [value])
        );
      } finally {
        setUploading(false);
        setCardEditing(false);
      }
    },
    [disabled, nodeId, setCardEditing, updateNodeData, uploadBinaryData]
  );

  const gridCols =
    images.length === 1
      ? "grid-cols-1"
      : images.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <>
      {uploadConfirmDialog}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleUploadFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div
        className={cn(
          "relative h-full w-full overflow-hidden cursor-grab select-none",
          uploading && "opacity-70",
          className
        )}
        style={{
          width: AI_IMAGE_CARD_WIDTH_PX,
          height: AI_IMAGE_CARD_HEIGHT_PX,
        }}
        onDoubleClick={handleCardDoubleClick}
      >
        {images.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[11px] text-muted-foreground/50 italic">
              {cardPlaceholder}
            </p>
          </div>
        ) : (
          <div className={cn("grid h-full w-full gap-0", gridCols)}>
            {images.map((img, idx) => (
              <MediaImageField
                key={getMediaReferenceKey(img) ?? idx}
                value={img}
                createObjectUrl={createObjectUrl}
                className="h-full w-full min-h-0 rounded-none border-0"
              />
            ))}
          </div>
        )}

        <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
          {showHistoryIcon ? (
            <AiImageHistoryButton
              count={historyItems.items.length}
              onClick={() => setHistoryOpen(true)}
            />
          ) : null}
          {images.length > 0 ? (
            <AiImageExpandButton onClick={() => setExpandOpen(true)} />
          ) : null}
        </div>
      </div>

      {images.length > 0 ? (
        <AiImageExpandOverlay
          open={expandOpen}
          title={t("workflow.aiImagePanel.outputTitle")}
          images={images}
          createObjectUrl={createObjectUrl}
          onClose={() => setExpandOpen(false)}
        />
      ) : null}

      {showHistoryIcon ? (
        <AiImageHistoryOverlay
          open={historyOpen}
          history={historyItems}
          currentImages={images}
          createObjectUrl={createObjectUrl}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
        />
      ) : null}
    </>
  );
}

export const aiImageWidget = createWidget({
  component: AiImageWidget,
  nodeTypes: [AI_IMAGE_NODE_TYPE],
  inputField: "prompt",
  managedFields: [
    "model",
    "prompt",
    "count",
    "params",
    "manual_images",
    "images_result",
    "images_history",
    "reference_images",
    "ai_interface_id",
  ],
  extractConfig: (nodeId, inputs, outputs, metadata) => ({
    images: readAiImageCardImages(inputs, outputs, metadata),
    historyItems: readAiImageResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
