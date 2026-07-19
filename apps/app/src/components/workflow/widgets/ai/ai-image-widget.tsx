import { AI_IMAGE_NODE_TYPE, getMediaReferenceKey, type MediaReference } from "@dafthunk/types";
import { useCallback, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
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
  readAiImageResult,
  readAiImageResultHistory,
  withAiImageHistorySelection,
} from "../../ai-image-node-utils";
import { MediaImageField } from "../../fields/media-image-field";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiImageWidgetProps extends BaseWidgetProps {
  images: MediaReference[];
  historyItems: ReturnType<typeof readAiImageResultHistory>;
  nodeId: string;
  createObjectUrl?: (objectReference: import("@dafthunk/types").ObjectReference) => string;
}

function AiImageWidget({
  images,
  historyItems,
  disabled = false,
  className,
  nodeId,
  createObjectUrl,
}: AiImageWidgetProps) {
  const { t } = useTranslation();
  const { updateNodeData } = useWorkflow();
  const [expandOpen, setExpandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const gridCols =
    images.length === 1
      ? "grid-cols-1"
      : images.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden p-2 cursor-grab select-none",
          className
        )}
        style={{
          width: AI_IMAGE_CARD_WIDTH_PX,
          height: AI_IMAGE_CARD_HEIGHT_PX,
        }}
      >
        {images.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[11px] text-muted-foreground/50 italic">
              {t("workflow.aiImagePanel.outputPlaceholder")}
            </p>
          </div>
        ) : (
          <div className={cn("grid h-full gap-1", gridCols)}>
            {images.map((img, idx) => (
              <MediaImageField
                key={getMediaReferenceKey(img) ?? idx}
                value={img}
                createObjectUrl={createObjectUrl}
              />
            ))}
          </div>
        )}

        <div className="nodrag nopan nowheel absolute right-[7px] top-[7px] z-50 flex items-center gap-1.5">
          <AiImageHistoryButton
            count={historyItems.items.length}
            onClick={() => setHistoryOpen(true)}
          />
          <AiImageExpandButton onClick={() => setExpandOpen(true)} />
        </div>
      </div>

      <AiImageExpandOverlay
        open={expandOpen}
        title={t("workflow.aiImagePanel.outputTitle")}
        images={images}
        createObjectUrl={createObjectUrl}
        onClose={() => setExpandOpen(false)}
      />

      <AiImageHistoryOverlay
        open={historyOpen}
        history={historyItems}
        currentImages={images}
        createObjectUrl={createObjectUrl}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleHistorySelect}
      />
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
  extractConfig: (nodeId, inputs, outputs) => ({
    images: readAiImageResult(inputs, outputs),
    historyItems: readAiImageResultHistory(inputs),
    nodeId,
  }),
});
