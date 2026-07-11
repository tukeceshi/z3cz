import type { ObjectReference } from "@dafthunk/types";

import { cn } from "@/utils/utils";

import { ImageField } from "../../fields/image-field";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiImageWidgetProps extends BaseWidgetProps {
  images: ObjectReference[];
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiImageWidget({ images, className, createObjectUrl }: AiImageWidgetProps) {
  if (!images || images.length === 0) {
    return (
      <div className={cn("p-2 min-h-[40px]", className)}>
        <p className="text-[11px] text-muted-foreground/50 italic">
          No images yet
        </p>
      </div>
    );
  }

  const gridCols =
    images.length === 1 ? "grid-cols-1" : images.length <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className={cn("p-1 grid gap-1", gridCols, className)}>
      {images.map((img, idx) => (
        <ImageField
          key={`${img.id ?? idx}`}
          parameter={{ id: `img-${idx}`, name: "image", type: "image" }}
          value={img}
          onChange={() => {}}
          onClear={() => {}}
          createObjectUrl={createObjectUrl}
          disabled
        />
      ))}
    </div>
  );
}

export const aiImageWidget = createWidget({
  component: AiImageWidget,
  nodeTypes: ["ai-image"],
  inputField: "prompt",
  managedFields: ["model", "prompt", "count", "params", "manual_images"],
  extractConfig: (_nodeId, _inputs, outputs) => {
    const imagesOutput = outputs?.find((o) => o.id === "images");
    const raw = imagesOutput?.value;
    const images: ObjectReference[] = Array.isArray(raw)
      ? (raw as unknown[]).filter(
          (v): v is ObjectReference =>
            !!v && typeof v === "object" && "id" in v && "mimeType" in v
        )
      : [];
    return { images };
  },
});
