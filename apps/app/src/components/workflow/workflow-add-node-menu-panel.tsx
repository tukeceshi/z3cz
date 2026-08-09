import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type AiGenerativeNodeType,
} from "@dafthunk/types";
import Image from "lucide-react/icons/image";
import Music from "lucide-react/icons/music";
import Type from "lucide-react/icons/type";
import Video from "lucide-react/icons/video";
import type { ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

const MENU_ITEMS: readonly {
  readonly type: AiGenerativeNodeType;
  readonly labelKey: TranslationKey;
  readonly icon: ReactNode;
}[] = [
  {
    type: AI_TEXT_NODE_TYPE,
    labelKey: "workflow.canvas.aiText",
    icon: <Type className="size-4" />,
  },
  {
    type: AI_IMAGE_NODE_TYPE,
    labelKey: "workflow.canvas.aiImage",
    icon: <Image className="size-4" />,
  },
  {
    type: AI_VIDEO_NODE_TYPE,
    labelKey: "workflow.canvas.aiVideo",
    icon: <Video className="size-4" />,
  },
  {
    type: AI_AUDIO_NODE_TYPE,
    labelKey: "workflow.canvas.aiAudio",
    icon: <Music className="size-4" />,
  },
];

export const WORKFLOW_ADD_NODE_MENU_SHELL = cn(
  "min-w-42 rounded-xl border border-neutral-200",
  "bg-white/95 p-2 shadow-xl backdrop-blur-sm",
  "dark:border-neutral-700/80 dark:bg-neutral-900/95"
);

export interface WorkflowAddNodeMenuPanelProps {
  readonly onSelect: (nodeType: AiGenerativeNodeType) => void;
  readonly className?: string;
}

export function WorkflowAddNodeMenuPanel({
  onSelect,
  className,
}: WorkflowAddNodeMenuPanelProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(WORKFLOW_ADD_NODE_MENU_SHELL, className)}>
      <p className="px-2 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {t("workflow.canvas.addNode")}
      </p>
      <div className="flex flex-col gap-0.5">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
              "text-neutral-900 hover:bg-neutral-100",
              "dark:text-neutral-100 dark:hover:bg-neutral-800"
            )}
            onClick={() => onSelect(item.type)}
          >
            <span className="text-neutral-500 dark:text-neutral-400">
              {item.icon}
            </span>
            {t(item.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
