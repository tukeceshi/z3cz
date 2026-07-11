import { cn } from "@/utils/utils";

import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiTextWidgetProps extends BaseWidgetProps {
  text: string | undefined;
}

function AiTextWidget({ text, className }: AiTextWidgetProps) {
  if (!text) {
    return (
      <div className={cn("p-2 min-h-[40px]", className)}>
        <p className="text-[11px] text-muted-foreground/50 italic">
          No output yet
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-2", className)}>
      <p className="text-[11px] text-foreground/80 line-clamp-4 whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}

export const aiTextWidget = createWidget({
  component: AiTextWidget,
  nodeTypes: ["ai-text"],
  inputField: "prompt",
  managedFields: ["ai_interface_id", "model", "prompt", "manual_text"],
  extractConfig: (_nodeId, _inputs, outputs) => {
    const textOutput = outputs?.find((o) => o.id === "text");
    return {
      text: typeof textOutput?.value === "string" ? textOutput.value : undefined,
    };
  },
});
