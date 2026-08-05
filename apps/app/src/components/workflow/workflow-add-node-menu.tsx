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
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

import type { AddNodeConnectionDragHandle } from "./workflow-add-node-connection";

export interface WorkflowAddNodeMenuState {
  readonly screenX: number;
  readonly screenY: number;
  readonly flowX: number;
  readonly flowY: number;
  readonly sourceContext?: {
    readonly nodeId: string;
    readonly handle: AddNodeConnectionDragHandle;
  };
}

interface WorkflowAddNodeMenuProps {
  readonly state: WorkflowAddNodeMenuState | null;
  readonly onSelect: (
    nodeType: AiGenerativeNodeType,
    menu: WorkflowAddNodeMenuState
  ) => void;
  readonly onClose: () => void;
}

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

export function WorkflowAddNodeMenu({
  state,
  onSelect,
  onClose,
}: WorkflowAddNodeMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, state]);

  const handleSelect = useCallback(
    (nodeType: AiGenerativeNodeType) => {
      if (!state) {
        return;
      }
      onSelect(nodeType, state);
      onClose();
    },
    [onClose, onSelect, state]
  );

  if (!state) {
    return null;
  }

  const menuWidth = 168;
  const menuHeight = 220;
  const viewportPadding = 8;
  const left = Math.min(
    Math.max(state.screenX, viewportPadding),
    window.innerWidth - menuWidth - viewportPadding
  );
  const top = Math.min(
    Math.max(state.screenY, viewportPadding),
    window.innerHeight - menuHeight - viewportPadding
  );

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-42 rounded-xl border border-neutral-200",
        "bg-white/95 p-2 shadow-xl backdrop-blur-sm",
        "dark:border-neutral-700/80 dark:bg-neutral-900/95"
      )}
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
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
            onClick={() => handleSelect(item.type)}
          >
            <span className="text-neutral-500 dark:text-neutral-400">{item.icon}</span>
            {t(item.labelKey)}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
