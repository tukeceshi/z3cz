import Keyboard from "lucide-react/icons/keyboard";
import X from "lucide-react/icons/x";
import { useCallback, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { cn, getModifierKey } from "@/utils/utils";

import {
  readCanvasShortcutHintCollapsed,
  writeCanvasShortcutHintCollapsed,
} from "./canvas-shortcut-hint-storage";

const PANEL_CLASS =
  "border-white/20 bg-transparent text-neutral-800 backdrop-blur-[2px] dark:border-white/20 dark:text-white";

const COLLAPSED_BUTTON_CLASS =
  "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

const KBD_CLASS =
  "inline-flex items-center justify-center rounded border border-black/20 bg-transparent px-1.5 py-0.5 font-mono text-xs leading-none text-current dark:border-white/30";

function ShortcutKbd({ children }: { readonly children: string }) {
  return <kbd className={KBD_CLASS}>{children}</kbd>;
}

export function CanvasShortcutHint() {
  const { t } = useTranslation();
  const modifierKey = getModifierKey();
  const [collapsed, setCollapsed] = useState(() =>
    readCanvasShortcutHintCollapsed()
  );

  const handleSetCollapsed = useCallback((next: boolean) => {
    writeCanvasShortcutHintCollapsed(next);
    setCollapsed(next);
  }, []);

  if (collapsed) {
    return (
      <div className="nodrag nopan nowheel pointer-events-auto absolute top-4 left-4 z-50">
        <button
          type="button"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border",
            COLLAPSED_BUTTON_CLASS
          )}
          aria-label={t("workflow.canvas.shortcutHint.expand")}
          title={t("workflow.canvas.shortcutHint.expand")}
          onClick={(event) => {
            event.stopPropagation();
            handleSetCollapsed(false);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Keyboard className="size-5" />
        </button>
      </div>
    );
  }

  const shortcuts = [
    {
      id: "copy-cut-paste",
      keys: [modifierKey, "C/X/V"],
      label: t("workflow.canvas.shortcutHint.copyCutPaste"),
    },
    {
      id: "delete",
      keys: ["Delete"],
      label: t("workflow.canvas.delete"),
    },
    {
      id: "multi-select",
      keys: ["Shift", t("workflow.canvas.shortcutHint.click")],
      label: t("workflow.canvas.shortcutHint.multiSelect"),
    },
  ] as const;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel pointer-events-auto absolute top-4 left-4 z-50",
        "rounded-lg border p-3.5",
        PANEL_CLASS
      )}
      role="region"
      aria-label={t("workflow.canvas.shortcutHint.title")}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {t("workflow.canvas.shortcutHint.title")}
        </span>
        <button
          type="button"
          className="rounded p-0.5 opacity-50 hover:opacity-100"
          aria-label={t("workflow.canvas.shortcutHint.collapse")}
          title={t("workflow.canvas.shortcutHint.collapse")}
          onClick={(event) => {
            event.stopPropagation();
            handleSetCollapsed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-2">
        {shortcuts.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1">
              {item.keys.map((key) => (
                <ShortcutKbd key={key}>{key}</ShortcutKbd>
              ))}
            </span>
            <span className="whitespace-nowrap text-sm">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
