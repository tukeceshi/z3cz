import type { ObjectReference } from "@dafthunk/types";
import { useState } from "react";

import { cn } from "@/utils/utils";

import { VideoField } from "../../fields/video-field";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiVideoWidgetProps extends BaseWidgetProps {
  videos: ObjectReference[];
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiVideoWidget({ videos, className, createObjectUrl }: AiVideoWidgetProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!videos || videos.length === 0) {
    return (
      <div className={cn("p-2 min-h-[40px]", className)}>
        <p className="text-[11px] text-muted-foreground/50 italic">
          No videos yet
        </p>
      </div>
    );
  }

  const activeVideo = videos[activeIdx] ?? videos[0];

  return (
    <div className={cn("flex flex-col gap-1 p-1", className)}>
      <VideoField
        parameter={{ id: "preview", name: "video", type: "video" }}
        value={activeVideo}
        onChange={() => {}}
        onClear={() => {}}
        createObjectUrl={createObjectUrl}
        disabled
      />
      {videos.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {videos.map((v, idx) => (
            <button
              key={`${v.id ?? idx}`}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border",
                idx === activeIdx
                  ? "border-blue-500 text-blue-500"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const aiVideoWidget = createWidget({
  component: AiVideoWidget,
  nodeTypes: ["ai-video"],
  inputField: "prompt",
  managedFields: ["model", "prompt", "params", "manual_videos"],
  extractConfig: (_nodeId, _inputs, outputs) => {
    const videosOutput = outputs?.find((o) => o.id === "videos");
    const raw = videosOutput?.value;
    const videos: ObjectReference[] = Array.isArray(raw)
      ? (raw as unknown[]).filter(
          (v): v is ObjectReference =>
            !!v && typeof v === "object" && "id" in v && "mimeType" in v
        )
      : [];
    return { videos };
  },
});
